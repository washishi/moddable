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

const I2C_AXP2101 = {...INTERNAL_I2C,...{address: 0x34,	hz: 400000}}; // Power
const I2C_AW9523  = {...INTERNAL_I2C,...{address: 0x58,	hz: 400000}}; // IO Exp
const I2C_AW88298 = {...INTERNAL_I2C,...{address: 0x36,	hz: 400000}}; // AudioOut
const I2C_ES7210  = {...INTERNAL_I2C,...{address: 0x40,	hz: 400000}}; // AudioIn
const I2C_BM8563  = {...INTERNAL_I2C,...{address: 0x51, hz: 100000}};	// RTC

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
		if (undefined !== globalThis.power)
			globalThis.power.brightness = value;
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
  // boost
  power.coreS3_VBUS_boost(true);
	// set USB_IN_BUS_OUT
  ioexp.SetPowerMode(POWER_MODE_USB_IN_BUS_OUT)
  //ioexp.SetPowerMode(POWER_MODE_USB_IN_BUS_IN)

	trace("reset LCD\n");
  ioexp.resetLcd();

  // AW88298 init
  globalThis.audioout = new AW88298(I2C_AW88298);
	trace("audio out3\n");




  // speaker
	// power.speaker.enable = true;

  // start-up sound
  if (config.startupSound) {
	trace("speaker\n");
	const speaker = new AudioOut({streams: 1});
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
	this.writeByte(0x00,0x00)
	this.writeByte(0x01,0x00)
	this.writeByte(0x0d,0x00)
	trace("BM8563 init end\n");
	}
}

// I/O Exp
class AW9523 extends SMBus {
  constructor(modI2CConfig) {
	  super({...{address: 0x58, hz: 400000},...modI2CConfig});
		trace("AW9523 start\n");
		// AW9523 Port
		//		  Port0				Port1
		// bit0	TOUCH_RST	  CAM_RST				AW88298:AudioOut
		// bit1	BUS_OUT_EN  LCD_RST		  	ES7210: AudioIn
		// bit2	AW88298_RST TOUCH_INT		  SY7088: PowerBOOST
		// bit3	ES7210_INT  AW88298_INT
		// bit4	TF_SW		  	NC
		// bit5	USB_OUT_EN  NC
		// bit6	NC		  		NC
		// bit7	NC		  		SY7088_EN
		//
		// AW9523 initialyze and Reset
		// TOUCH_RST BUS_OUT_EN=0 AW88298_RST USB_OUT_EN=0 USB_OUT_EN=0
	  this.writeByte(0x02, 0b00000101);  // P0 output state (0:low 1:high)
	  this.writeByte(0x03, 0b00000011);  // P1 output state (0:low 1:high)
		this.writeByte(0x04, 0b00011000);  // Config_Port0 (0:output 1:input)
		this.writeByte(0x05, 0b00001100);  // Config_Port1 (0:output 1:input)
		this.writeByte(0x11, 0b00010000);  // CTL (Push-Pull mode)
		this.writeByte(0x12, 0b11111111);  // P0 LED_Mode_Switch (1:GPIO mode 0:LED mode)
		this.writeByte(0x13, 0b11111111);  // P1 LED_Mode_Switch (1:GPIO mode 0:LED mode)
	  trace("AW9523 end\n");
  }

	// LCD Reset AW9523B P1_1
  resetLcd() {
	  this.writeByte(0x03, (this.readByte(0x03) & 0b11111101));
		Timer.delay(20);
		this.writeByte(0x03, (this.readByte(0x03) | 0b00000010));
		trace("Reset LCD\n");
  }
	SetPowerMode(mode) {
		trace("mode:",mode,"\n");
    switch (mode) {
      case POWER_MODE_USB_IN_BUS_IN:
				trace("set mode 0\n");
				this.writeByte(0x02, (this.readByte(0x02) & 0b11011101));
				this.writeByte(0x03, (this.readByte(0x03) & 0b01111111)); // BOOST_DIS
        break;
      case POWER_MODE_USB_IN_BUS_OUT:
				trace("set mode 1\n");
				this.writeByte(0x02, (this.readByte(0x02) & 0b11011111));
				this.writeByte(0x02, (this.readByte(0x02) | 0b00000010));
				this.writeByte(0x03, (this.readByte(0x03) | 0b10000000));  // BOOST_EN
        break;
      case POWER_MODE_USB_OUT_BUS_IN:
				trace("set mode 2\n");
        this.writeByte(0x02, (this.readByte(0x02) | 0b00100000));
				this.writeByte(0x02, (this.readByte(0x02) & 0b11111101));
				this.writeByte(0x03, (this.readByte(0x03) & 0b01111111)); // BOOST_DIS
        break;
      case POWER_MODE_USB_OUT_BUS_OUT:
				trace("set mode 3\n");
        this.writeByte(0x02, (this.readByte(0x02) | 0b00100010));
				this.writeByte(0x03, (this.readByte(0x03) | 0b10000000));  // BOOST_EN
        break;
      default:
        break;
    }
		trace("get\n");
    this.GetPowerMode();
	}
	GetPowerMode() {
		trace("get1\n");
    const data = this.readByte(0x02);
		 trace("get2\n");
 		const power_mode = ((data >> 1) & 0b1) + ((data >> 4) & 0b10);
		 trace("get3\n");
 		trace("return\n");
    return power_mode;
	}
}

// Power
class AXP2101 extends SMBus {
  constructor(modI2CConfig,ioexp) {
		super({...{address: 0x34,	hz: 400000},...modI2CConfig});
		trace("AXP2101 init\n");
		// AXP2101
		this.writeByte(0x69, 0b00110101);  // AXP CHG_LED
		this.writeByte(0x90, 0xbf);	// AXP ALDO~4,BLDO0~2,DIDO1 Enable
		this.writeByte(0x92, 12);		// ALDO1 set to 1.8v for AW88298
		this.writeByte(0x93, 28);		// ALDO2 set to 3.3v for ES7210
		this.writeByte(0x94, 28);		// ALDO3 set to 3.3v for camera
		this.writeByte(0x95, 28);		// ALDO4 set to 3.3v for TF card slot
		trace("AXP2101 init end\n");
	}
  // vbus boost state setup
  //  param state Ture:Enable
	coreS3_VBUS_boost(state) {
		if (state) {
			// 1
			this.writeByte(0xf0, 0x06);
			// 2
			this.writeByte(0xf1, this.readByte(0xf1) | 0b00000100);
			// 3
			this.writeByte(0xff, 0x01);
			// 4
			this.writeByte(0x20, 0x01);
			// 5
			this.writeByte(0xff, 0x00);
			// 6
			this.writeByte(0xf1, this.readByte(0xf1) & ~ 0b00000100);
			// 7
			this.writeByte(0xf0, 0x00);
			// enable boost
			ioexp.writeByte(0x02, 0b00000110);
			trace("boost on\n");
		} else {
			// disable boost
			ioexp.writeByte(0x02, 0b00000100);
			// 1
			this.writeByte(0xf0, 0x06);
			// 2
			this.writeByte(0xf1, this.readByte(0xf1) | 0b00000100);
			// 3
			this.writeByte(0xff, 0x01);
			// 4
			this.writeByte(0x20, 0x00);
			// 5
			this.writeByte(0xff, 0x00);
			// 6
			this.writeByte(0xf1, this.readByte(0xf1) & ~ 0b00000100);
			// 7
			this.writeByte(0xf0, 0x00);
			trace("boost off\n");
		}
  }
}


// Audio Out
class AW88298 extends SMBus {
  constructor(modI2CConfig) {
		super({...{address: 0x36,	hz: 400000},...modI2CConfig});
		trace("AW88298 init\n");
		const rate_tbl = [4,5,6,8,10,11,15,20,22,44];
		let reg0x06_value = 0;
		let sample_rate = 11025;
		let rate = Math.round((sample_rate + 1102) / 2205);
		while (rate > rate_tbl[reg0x06_value] && ++reg0x06_value < rate_tbl.length){};
		reg0x06_value |= 0x14C0;  // I2SBCK=0 (BCK mode 16*2)
		this.writeWord( 0x61, 0x0673 );	 // boost mode disabled 
		this.writeWord( 0x04, 0x4040 );	 // I2SEN=1 AMPPD=0 PWDN=0
		this.writeWord( 0x05, 0x0008 );	 // RMSE=0 HAGCE=0 HDCCE=0 HMUTE=0
		this.writeWord( 0x06, reg0x06_value );
		this.writeWord( 0x0C, 0x0064 );	 // volume setting (full volume)
		trace("AW88298 init end\n");
  }
}
