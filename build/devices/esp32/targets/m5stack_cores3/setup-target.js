/*
 * Copyright (c) 2020-2022  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK Runtime.
 *
 *   The Moddable SDK Runtime is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Lesser General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   The Moddable SDK Runtime is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public License
 *   along with the Moddable SDK Runtime.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

import AudioOut from "pins/audioout";
import Resource from "Resource";
import Timer from "timer";
import config from "mc/config";
import SMBus from "pins/smbus";

const INTERNAL_I2C = Object.freeze({
	sda: 12,
	scl: 11,
});

const I2C_BM8563  = Object.freeze({...INTERNAL_I2C,...{address: 0x51, hz: 400000}}); // RTC
const I2C_AXP2101 = Object.freeze({...INTERNAL_I2C,...{address: 0x34, hz: 400000}}); // Power
const I2C_AW9523  = Object.freeze({...INTERNAL_I2C,...{address: 0x58, hz: 400000}}); // IO Exp
const I2C_AW88298 = Object.freeze({...INTERNAL_I2C,...{address: 0x36, hz: 400000}}); // AudioOut
const I2C_ES7210  = Object.freeze({...INTERNAL_I2C,...{address: 0x40, hz: 400000}}); // AudioIn

const POWER_MODE_USB_IN_BUS_IN   = 0
const POWER_MODE_USB_IN_BUS_OUT  = 1
const POWER_MODE_USB_OUT_BUS_IN  = 2
const POWER_MODE_USB_OUT_BUS_OUT = 3

globalThis.Host = {
	Backlight: class {
		constructor(brightness = 100) {
		this.write(brightness);
		}
		write(value) {
			if (undefined !== globalThis.power) {
				globalThis.power.brightness = value;
			}
		}
		close() {}
	}
}


export default function (done) {
	trace("start\n");
	// rtc
	globalThis.rtc = new BM8563(I2C_BM8563);
	
	// power
	globalThis.power = new AXP2101(I2C_AXP2101);

	// I/O Exp
	globalThis.ioexp = new AW9523(I2C_AW9523);

	// set power mode
	ioexp.powermode = POWER_MODE_USB_IN_BUS_OUT;
	//ioexp.powermode = POWER_MODE_USB_IN_BUS_IN;

	// Chage Enable
	if (power.batpercent >= 0 && power.batpercent < 100) {
		power.chargeled(true);
		power.chargeenable(true);
	} else {
		power.chargeled(false);
		power.chargeenable(false);
	}

	// AXP2101 ADC display
	let adc=power.adcsampling;
	trace("vbat:",adc.vbat,"V ");
	if (power.batpercent != -1 )
		trace(power.batpercent,"%\n");
	else
		trace("Battery not connected\n");
	trace("vbus:",adc.vbus,"V\n");
	trace("vsys:",adc.vsys,"V\n");
	trace("AXP2101 Temp:",adc.tdie,"°C\n");

	// LCD reset
	ioexp.resetLcd();

	// LCD breihtness
	const brightness = config.brightness ?? 100;
	let i=0;
	while (i <= brightness) {
		power.brightness = i;
		i+=10;
		Timer.delay(50);
	};

	// AW88298 init
	globalThis.amp = new AW88298(I2C_AW88298);
	// set sampling rate
	const speaker = new AudioOut({streams: 1});
	amp.sample_rate = speaker.sampleRate;
	// start-up sound
	if (config.startupSound) {
  		trace("startup sound play\n");
		speaker.callback = function () {
			this.stop();
			this.close();
			this.done();
	  	};
		speaker.done = done;
		done = undefined;
		speaker.enqueue(0, AudioOut.Samples, new Resource(config.startupSound));
		speaker.enqueue(0, AudioOut.Callback, 0);
		speaker.start();
	}
	trace("end\n");

  done?.();
}

// RTC
class BM8563 extends SMBus {
	constructor(modI2CConfig) {
		super({...{address: 0x51, hz: 100000},...modI2CConfig});
		// BM8563 Init (clear INT)
		trace("BM8563 init\n");
		this.writeByte(0x00,0x00); // TEST=0 STOP=0 TESTC=0
		this.writeByte(0x01,0x00); // Alarm off
		this.writeByte(0x0d,0x00); // ClockOut(NC) disable
		trace("BM8563 init end\n");
	}
}

// I/O Exp
class AW9523 extends SMBus {
	constructor(modI2CConfig) {
		super({...{address: 0x58, hz: 400000},...modI2CConfig});
		trace("AW9523 init\n");
		// AW9523 I/O Expander
		//		Port0		Port1
		// bit0	TOUCH_RST	CAM_RST			AW88298:AudioOut
		// bit1	BUS_OUT_EN  LCD_RST			ES7210: AudioIn
		// bit2	AW88298_RST TOUCH_INT		SY7088: BusPower boost
		// bit3	ES7210_INT  AW88298_INT
		// bit4	TF_SW		NC
		// bit5	USB_OUT_EN	NC
		// bit6	NC			NC
		// bit7	NC			SY7088_EN
		//
		// AW9523 initialyze and Reset
		this.writeByte(0x02, 0b00000101);	// P0 output state (0:low 1:high)
		this.writeByte(0x03, 0b00000011);	// P1 output state (0:low 1:high)
		this.writeByte(0x04, 0b00011000);	// Config_Port0 (0:output 1:input)
		this.writeByte(0x05, 0b00001100);	// Config_Port1 (0:output 1:input)
		this.writeByte(0x11, 0b00010000);	// CTL (Push-Pull mode)
		this.writeByte(0x12, 0b11111111);	// P0 LED_Mode_Switch (1:GPIO mode 0:LED mode)
		this.writeByte(0x13, 0b11111111);	// P1 LED_Mode_Switch (1:GPIO mode 0:LED mode)
		trace("AW9523 init end\n");
  	}

	// LCD Reset AW9523B P1_1
	resetLcd() {
		this.writeByte(0x03, (this.readByte(0x03) & 0b11111101));
		Timer.delay(20);
		this.writeByte(0x03, (this.readByte(0x03) | 0b00000010));
		trace("Reset LCD\n");
	}
	// Power Mode AW9523B P0_1:BUS_OUT_EN P0_5:USB_OUT_EN P1_7:BOOST_EN
	set powermode(mode) {
    	switch (mode) {
    		case POWER_MODE_USB_IN_BUS_IN:
			this.writeByte(0x02, (this.readByte(0x02) & 0b11011101));
			this.writeByte(0x03, (this.readByte(0x03) & 0b01111111)); // BOOST_DIS
        	break;
      	case POWER_MODE_USB_IN_BUS_OUT:
			this.writeByte(0x02, (this.readByte(0x02) & 0b11011111));
			this.writeByte(0x02, (this.readByte(0x02) | 0b00000010));
			this.writeByte(0x03, (this.readByte(0x03) | 0b10000000));  // BOOST_EN
        	break;
    	case POWER_MODE_USB_OUT_BUS_IN:
        	this.writeByte(0x02, (this.readByte(0x02) | 0b00100000));
			this.writeByte(0x02, (this.readByte(0x02) & 0b11111101));
			this.writeByte(0x03, (this.readByte(0x03) & 0b01111111)); // BOOST_DIS
        	break;
      	case POWER_MODE_USB_OUT_BUS_OUT:
        	this.writeByte(0x02, (this.readByte(0x02) | 0b00100010));
			this.writeByte(0x03, (this.readByte(0x03) | 0b10000000));  // BOOST_EN
        	break;
      	default:
        	break;
    	}
	}
	get powermode() {
    	const data = this.readByte(0x02);
 		const power_mode = ((data >> 1) & 0b1) + ((data >> 4) & 0b10);
    	return power_mode;
	}
}

// Power
class AXP2101 extends SMBus {
	constructor(modI2CConfig,ioexp) {
		super({...{address: 0x34,	hz: 400000},...modI2CConfig});
		trace("AXP2101 init\n");
		// AXP2101
		this.writeByte(0x90, 0xbf);	// AXP2101 ALDO1~4,BLDO1~2,DLDO1 Enable
		this.writeByte(0x92, 13);		// ALDO1 set to  1.8v for AW88298
		this.writeByte(0x93, 28);		// ALDO2 set to  3.3v for ES7210
		this.writeByte(0x94, 28);		// ALDO3 set to  3.3v for CameraBord 3V3
		this.writeByte(0x95, 28);		// ALDO4 set to  3.3v for TF card slot
										// BLDO1 default 1.8V for CameraBord AVDD
										// BLDO2 default 2.8V for CameraBord DVDD
		this.writeByte(0x99, 0);		// DLDO1 set to    0V for LCD BL
		trace("AXP2101 init end\n");
	}
	// LCD brightness  value 0 - 100 % (step 10%)
	// DLDO1 0V,2.4V~3.3V (step 0.1V)
	set brightness(value) {
		if (value <= 0)
			value = 0;
		else if (value >= 100)
			value = 28;
		else
			value = Math.round(value / 10 + 18);
		this.writeByte(0x99, value);
	}
	get brightness() {
		let value = this.readByte(0x99);
		if (value <= 18)
			value = 0;
		else
			value = (value - 18) * 10;
		return (value);
	}
	chargeled(value) {
		if (value)
			this.writeByte(0x69, 0b00110101);
		else
			this.writeByte(0x69, (this.readByte(0x60) & 0b11111110));
	}
	// charging
	// 0b00:Standby 0b01:charge 0b10:discharge
	get charging() {
		let data = this.readByte(0x01);
    	return (data >> 5) & 0b11;
	}
	chargeenable(value) {
    if (value)
		this.writeByte(0x33, ((this.readByte(0x33) | 0B10000000)));
    else
		this.writeByte(0x33, ((this.readByte(0x33) & 0B01111111)));
	}
	setchargecurrent(current) {
    	this.writeByte(0x33, ((this.readByte(0x33) & 0B11110000) | current));
	}
	poweroff() {
    	this.writeByte(0x10, (this.readByte(0x10) | 0B00000001));
	}
	// AXP2101 ADC 
	// ts:unused
  	get adcsampling() {
		const adc={};
		this.writeByte(0x30, 0b111111); // ADC enable
    	adc.vbat = (((this.readByte(0x34) & 0x3f) << 8) | this.readByte(0x35)) / 1000;
    	adc.vbus = (((this.readByte(0x38) & 0x3f) << 8) | this.readByte(0x39)) / 1000;
    	adc.vsys = (((this.readByte(0x3a) & 0x3f) << 8) | this.readByte(0x3b)) / 1000;
		adc.ts =   (((this.readByte(0x36) & 0x3f) << 8) | this.readByte(0x37)) / 5000;
    	adc.tdie = 22 + ((7274 - ((this.readByte(0x3c) << 8) | this.readByte(0x3d))) / 20);
		if (!(this.readByte(0x00) & 0b001000)) {
			adc.vbat= 0.0;
		}
		if (!(this.readByte(0x00) & 0b100000)) {
    		adc.vbus = 0.0;
    	}
    	if (adc.vbus >= 16375) {
    		adc.vbus = 0.0;
    	}
		return(adc)
	}
	// battry charge percent   Returns -1 if the battery is not connected
	get batpercent() {
		if (!(this.readByte(0x00) & 0b001000)) {
			return(-1);
		} else {
			return(this.readByte(0xa4));
		}
	}
}


// Audio Out
class AW88298 extends SMBus {
	constructor(modI2CConfig) {
		super({...{address: 0x36, hz: 400000},...modI2CConfig});
		trace("AW88298 init\n");
		this.writeWord( 0x04, 0x0040, true);	// I2SEN=1 AMPPD=0 PWDN=0
		this.writeWord( 0x61, 0x0633, true);	// boost
		this.boostmode = 0;						// boost mode disable
		this.sample_rate = 24000;
		this.writeWord( 0x0C, 0xff64, true);	// volume setting
		this.volume = 100;						// full volume
		this.writeWord( 0x05, 0x0008, true);	// RMSE=0 HAGCE=0 HDCCE=0 HMUTE=0
		trace("AW88298 init end\n");
	}
	// sampling rate
	// 	8000,(11025),12000,16000,(22050),24000,32000,(44100),48000,96000,192000
	//  note moddable(audioOut) support 8000 ~ 48000
	// 	note 11025,22050,44100 is not working
	/**
	 * @param {number} value
	 */
	set sample_rate(value){
		trace("samplingrate:",value);
		const rate_tbl = [4,5,6,8,10,11,15,20,22,44];
		let reg0x06_value = 0;
		let rate = Math.round((value + 1102) / 2205);
		while (rate > rate_tbl[reg0x06_value] && ++reg0x06_value < rate_tbl.length);
		trace(" param:",reg0x06_value,"\n");
		reg0x06_value |= 0x14C0;  // I2SRXEN=1 CHSEL=01(left) I2SFS=11(32bits)
		this.writeWord( 0x06, reg0x06_value ,true);
	}
	// volume 0~100
	/**
	 * @param {number} value
	 */
	set volume(value){
		if (value < 0) value = 0;
		if (value > 100) value = 100;
		trace("volume:",value);
		value = Math.round((100 - value) * 256 / 100);
		trace(" param:",value," * 256\n");
		this.writeWord(0x0c, (value << 8)|((this.readWord(0x0c, true)) & 0x00ff) ,true);
	}
	//  boost mode
	//  0:boost off 1:force boost 5:smart boost 1 mode 6:smart bost 2 mode  other:boost off
 	/**
	 * @param {number} value
	 */
	set boostmode(value){
		if (value != 0 && value != 1 && value != 5 && value !=6 ) value = 0;
		trace("boost mode:",value," * 0x1000\n");
		this.writeWord(0x61c, (value << 12)|((this.readWord(0x61, true)) & 0x0fff) ,true);
	}
}
