// Procedural 4-stroke, 4-cylinder engine synth, run inside an AudioWorklet.
//
// Plain JS in public/, not bundled by Next.js -- AudioWorkletProcessors run
// in a separate worklet global scope with no module resolution or bundler
// cooperation, so `audioContext.audioWorklet.addModule()` needs a real,
// self-contained script served from a URL, not something webpack/Turbopack
// processes. This is adapted from mrdoob's Starter-Kit-Racing (MIT) --
// TrackForge has no vehicle audio at all yet, and this DSP core is the same
// regardless of physics engine, so it's ported close to verbatim; only the
// registerProcessor wrapper needed touching, since the class itself has zero
// dependency on crashcat/Three.js.
//
// Each cylinder fires once per engine cycle (2 crank revolutions) at a fixed,
// slightly uneven crank offset with a fixed per-cylinder gain; the stationary
// asymmetry builds the half-order harmonic comb. Cycle-to-cycle jitter stays
// small -- real combustion varies only a few percent.
//
// Per firing: a damped-chirp "thump" pulse (crossfaded to a rounder table as
// load drops) plus a band-passed noise burst. Combustion follows fuel rather
// than volume: it fades to near-silence when coasting at revs (deceleration
// fuel cut), leaving the mechanical layer, and sparse overrun pops fire on
// the firing grid into the exhaust pipe.
//
// Mix chain: ring-modulation by lowpassed noise -> exhaust-pipe feedback comb
// (feedback pumped by exhaust-valve state) -> tanh waveshaper -> fixed
// formants -> tracking lowpass -> parallel short-comb muffler. A broadband
// 3-9 kHz mechanical layer (valvetrain hash + ticks) bypasses the lowpass.

const CYLINDERS = 4;
const TABLE_SIZE = 2048;

const CRANK_OFFSETS = [0, 0.21, 0.495, 0.72];
const CYL_GAINS = [1.08, 0.94, 1.03, 0.92];

const RPM_IDLE = 1000;
const RPM_MAX = 6700;

class EngineCore {

	constructor( sampleRate ) {

		this.sampleRate = sampleRate;

		this.phase = 0; // engine cycle phase [0,1), 720 degrees of crank

		this.rpm = RPM_IDLE;
		this.load = 0;

		this.rpmSmooth = 1 - Math.exp( - 1 / ( 0.04 * sampleRate ) );
		this.loadSmooth = 1 - Math.exp( - 1 / ( 0.06 * sampleRate ) );

		this.jitter = new Float32Array( CYLINDERS ).fill( 1 );
		this.prevPos = new Float32Array( CYLINDERS );

		this.thumpTable = new Float32Array( TABLE_SIZE );
		this.thumpSoftTable = new Float32Array( TABLE_SIZE );
		this.gateTable = new Float32Array( TABLE_SIZE );

		for ( let i = 0; i < TABLE_SIZE; i++ ) {

			const u = i / TABLE_SIZE;

			const attack = Math.sin( Math.PI * 0.5 * Math.min( u * 12, 1 ) );
			this.thumpTable[ i ] = attack * (
				Math.sin( Math.PI * 2 * ( u * 1.4 + 0.9 * u * u ) ) * Math.exp( - 3.2 * u ) * 0.5 +
				Math.sin( Math.PI * 2 * ( u * 3.7 + 0.8 ) ) * Math.exp( - 6.5 * u ) * 0.55
			);

			const softAttack = Math.sin( Math.PI * 0.5 * Math.min( u * 6, 1 ) );
			this.thumpSoftTable[ i ] = softAttack * (
				Math.sin( Math.PI * 2 * ( u * 1.3 + 0.4 * u * u ) ) * Math.exp( - 3 * u ) * 0.85 +
				Math.sin( Math.PI * 2 * ( u * 2.9 + 0.6 ) ) * Math.exp( - 5.5 * u ) * 0.3
			);

			this.gateTable[ i ] = attack * Math.exp( - 6 * u );

		}

		this.svfLow = 0;
		this.svfBand = 0;

		this.wobble = 0;
		this.wobbleCoeff = 1 - Math.exp( - 2 * Math.PI * 60 / sampleRate );
		this.amNoise = 0;
		this.amCoeff = 1 - Math.exp( - 2 * Math.PI * 1800 / sampleRate );

		this.mechLp = 0;
		this.mechLpCoeff = 1 - Math.exp( - 2 * Math.PI * 3000 / sampleRate );
		this.tickEnv = 0;
		this.tickDecay = Math.exp( - 1 / ( 0.0012 * sampleRate ) );
		this.tickAmp = 0;

		this.popEnv = 0;
		this.popDecay = Math.exp( - 1 / ( 0.004 * sampleRate ) );
		this.popRing = 0;
		this.popRingDecay = Math.exp( - 1 / ( 0.1 * sampleRate ) );
		this.popClusterSlots = 0;
		this.liftOffSamples = 0;
		this.prevCombustion = 0;

		this.pipeBuffer = new Float32Array( 1024 );
		this.pipeIndex = 0;
		this.pipeDelay = Math.min( 1000, Math.round( sampleRate / 140 ) );
		this.pipeLp = 0;

		this.muffBuffers = [ new Float32Array( 32 ), new Float32Array( 32 ), new Float32Array( 32 ) ];
		this.muffDelays = [
			Math.max( 2, Math.round( 0.00018 * sampleRate ) ),
			Math.max( 3, Math.round( 0.00034 * sampleRate ) ),
			Math.max( 4, Math.round( 0.00055 * sampleRate ) ),
		];
		this.muffIndex = 0;

		this.formantF = [ 470, 780, 1024 ].map(
			( f ) => 2 * Math.sin( Math.PI * f / sampleRate )
		);
		this.formantGain = [ 1.0, 0.75, 0.55 ];
		this.formantLow = new Float32Array( 3 );
		this.formantBand = new Float32Array( 3 );

		this.lp1 = 0;
		this.lp2 = 0;
		this.dcR = 1 - 2 * Math.PI * 90 / sampleRate;
		this.dcState = 0;
		this.dcPrev = 0;

		this.noiseSeed = 22222;

	}

	process( output, n, targetRpm, targetLoad ) {

		const sr = this.sampleRate;

		const rpm01 = Math.min( 1, Math.max( 0, ( this.rpm - RPM_IDLE ) / ( RPM_MAX - RPM_IDLE ) ) );
		const load = this.load;

		const idleFuel = 0.02 + 0.23 * Math.min( 1, Math.max( 0, ( 0.3 - rpm01 ) / 0.3 ) );
		const combustion = Math.max( load, idleFuel );
		const combGain = Math.pow( combustion, 0.7 );
		const fuelCut = load < 0.05 && rpm01 > 0.18;

		if ( this.prevCombustion > 0.35 && combustion < 0.1 ) {

			this.liftOffSamples = Math.floor( 0.25 * sr );

		}

		this.prevCombustion = combustion;

		const noiseFreq = 700 + rpm01 * 1000;
		const svfF = 2 * Math.sin( Math.PI * Math.min( 0.24, noiseFreq / sr ) );
		const svfQ = 1.8;

		const cutoff = Math.min( 7000, 1400 * Math.pow( 2, load * 1.5 + rpm01 * 1.1 ) );
		const lpA = 1 - Math.exp( - 2 * Math.PI * cutoff / sr );

		const drive = 2.2 + load * 2.2 + rpm01 * 0.8;
		const post = 0.62 / Math.tanh( drive * 0.9 );

		const unevenness = 0.06 - 0.04 * Math.min( 1, load * 0.8 + rpm01 * 0.8 );

		const levelScale = Math.pow( combustion, 0.35 );

		const gateFloor = ( 0.06 + load * 0.3 ) * combustion;
		const raspGain = ( 2.6 + load * 0.9 ) * levelScale;
		const thumpGain = 1.4 * levelScale;
		const softMix = Math.min( 1, combustion * 2.2 );
		const subGain = 0.085 * ( 1 - rpm01 * 0.4 ) * levelScale;
		const whineGain = rpm01 * rpm01 * ( 0.25 + 0.75 * load ) * 0.045;
		const amDepth = 0.22 + load * 0.3;

		const mechGain = 0.02 + 0.045 * rpm01;
		const tickGain = 0.5 + rpm01 * 0.5;

		const popP = this.liftOffSamples > 0 ? 0.22 : 0.05;

		const wobbleAmt = 0.004 - 0.002 * rpm01;
		const pipeMask = this.pipeBuffer.length - 1;
		const muffMask = 31;

		for ( let i = 0; i < n; i++ ) {

			this.rpm += ( targetRpm - this.rpm ) * this.rpmSmooth;
			this.load += ( targetLoad - this.load ) * this.loadSmooth;
			if ( this.liftOffSamples > 0 ) this.liftOffSamples--;

			this.phase += this.rpm / 120 / sr;
			if ( this.phase >= 1 ) this.phase -= 1;

			this.wobble += ( this.random() * 2 - 1 - this.wobble ) * this.wobbleCoeff;
			const phase = this.phase + this.wobble * wobbleAmt;

			let thump = 0;
			let gate = gateFloor;
			let valveOpen = 0;

			for ( let k = 0; k < CYLINDERS; k++ ) {

				let s = phase - CRANK_OFFSETS[ k ];
				s -= Math.floor( s );

				if ( s < this.prevPos[ k ] ) {

					this.jitter[ k ] = 1 + ( this.random() * 2 - 1 ) * unevenness;

					this.tickEnv = 1;
					this.tickAmp = ( 0.2 + this.random() * 0.8 ) * tickGain;

					if ( fuelCut ) {

						const p = this.popClusterSlots > 0 ? popP * 3 : popP;
						if ( this.popClusterSlots > 0 ) this.popClusterSlots--;

						if ( this.random() < p ) {

							let amp = 0.5 * Math.exp( ( this.random() + this.random() - 1 ) * 1.1 );
							if ( this.random() < 0.06 ) amp *= 2.5;

							this.popEnv = Math.min( 1.6, amp );
							this.popRing = 1;
							this.popClusterSlots = 3 + ( this.random() * 3 | 0 );

						}

					}

				}

				this.prevPos[ k ] = s;

				const u = s * 4;

				if ( u < 1 ) {

					const ti = ( u * TABLE_SIZE ) | 0;
					const g = this.jitter[ k ] * CYL_GAINS[ k ];
					thump += ( this.thumpTable[ ti ] * softMix +
						this.thumpSoftTable[ ti ] * ( 1 - softMix ) ) * g;
					gate += this.gateTable[ ti ] * g;

					const vo = Math.sin( Math.PI * u );
					if ( vo > valveOpen ) valveOpen = vo;

				}

			}

			const white = this.random() * 2 - 1;
			this.svfLow += svfF * this.svfBand;
			const svfHigh = white - this.svfLow - svfQ * this.svfBand;
			this.svfBand += svfF * svfHigh;
			const rasp = this.svfBand * gate * raspGain;

			const sub = Math.sin( 6.2831853 * this.phase * CYLINDERS ) * subGain;
			const whine = Math.sin( 6.2831853 * this.phase * 2 * 12.6 ) * whineGain;

			let x = thump * thumpGain + rasp + sub + whine;

			if ( this.popEnv > 0.001 ) {

				const pw = this.random() * 2 - 1;
				x += ( pw + 0.7 * Math.abs( pw ) ) * this.popEnv;
				this.popEnv *= this.popDecay;

			}

			this.popRing *= this.popRingDecay;

			this.amNoise += ( white - this.amNoise ) * this.amCoeff;
			x *= 1 + this.amNoise * amDepth * 4;

			const fb = Math.min( 0.85, 0.7 - 0.62 * valveOpen + 0.3 * this.popRing );
			const read = this.pipeBuffer[ ( this.pipeIndex - this.pipeDelay ) & pipeMask ];
			this.pipeLp += ( read - this.pipeLp ) * 0.32;
			const pipe = x + this.pipeLp * fb;
			this.pipeBuffer[ this.pipeIndex & pipeMask ] = pipe;
			this.pipeIndex++;

			x = x * 0.4 + pipe * 0.6;

			x = Math.tanh( x * drive ) * post;

			let formants = 0;

			for ( let k = 0; k < 3; k++ ) {

				const f = this.formantF[ k ];
				this.formantLow[ k ] += f * this.formantBand[ k ];
				const high = x - this.formantLow[ k ] - 0.17 * this.formantBand[ k ];
				this.formantBand[ k ] += f * high;
				formants += this.formantBand[ k ] * this.formantGain[ k ];

			}

			x = x * 0.6 + formants * 0.5;

			let muff = 0;

			for ( let m = 0; m < 3; m++ ) {

				const buf = this.muffBuffers[ m ];
				const d = buf[ ( this.muffIndex - this.muffDelays[ m ] ) & muffMask ];
				buf[ this.muffIndex & muffMask ] = x + d * 0.35;
				muff += d;

			}

			this.muffIndex++;
			x = x * 0.85 + muff * 0.1;

			this.lp1 += ( x - this.lp1 ) * lpA;
			this.lp2 += ( this.lp1 - this.lp2 ) * lpA;
			x = this.lp1 * 0.35 + this.lp2 * 0.65;

			this.mechLp += ( white - this.mechLp ) * this.mechLpCoeff;
			const hf = white - this.mechLp;
			x += hf * ( mechGain * ( 0.5 + gate ) + this.tickEnv * this.tickAmp * 0.12 );
			this.tickEnv *= this.tickDecay;

			const dc = x - this.dcPrev + this.dcR * this.dcState;
			this.dcPrev = x;
			this.dcState = dc;

			output[ i ] = Math.tanh( dc * 0.9 );

		}

	}

	random() {

		this.noiseSeed = ( this.noiseSeed * 1664525 + 1013904223 ) | 0;
		return ( this.noiseSeed >>> 9 ) / 8388608;

	}

}

class EngineSoundProcessor extends AudioWorkletProcessor {

	static get parameterDescriptors() {

		return [
			{ name: 'rpm', defaultValue: RPM_IDLE, minValue: 0, maxValue: 9000, automationRate: 'k-rate' },
			{ name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
		];

	}

	constructor() {

		super();
		this.core = new EngineCore( sampleRate );

	}

	process( inputs, outputs, parameters ) {

		const channels = outputs[ 0 ];
		const first = channels[ 0 ];

		this.core.process( first, first.length, parameters.rpm[ 0 ], parameters.load[ 0 ] );

		for ( let c = 1; c < channels.length; c++ ) {

			channels[ c ].set( first );

		}

		return true;

	}

}

registerProcessor( 'engine-sound', EngineSoundProcessor );
