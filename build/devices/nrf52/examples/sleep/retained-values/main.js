/*
 * Copyright (c) 2016-2020  Moddable Tech, Inc.
 *
 *   This file is part of the Moddable SDK.
 * 
 *   This work is licensed under the
 *       Creative Commons Attribution 4.0 International License.
 *   To view a copy of this license, visit
 *       <http://creativecommons.org/licenses/by/4.0>.
 *   or send a letter to Creative Commons, PO Box 1866,
 *   Mountain View, CA 94042, USA.
 *
 */
/*
	This application demonstrates how to retain 32-bit values in RAM across System Off power saving mode (deep sleep).
	The device is woken up from a digital input.
	The application turns on the LED while running and turns off the LED when asleep.
	Upon wakeup, the LED blinks if the retained values are valid.
	Press the button connected to the digital input pin to wakeup the device.
*/

import Sleep from "sleep";
import Timer from "timer";
import config from "mc/config";

const wakeup_pin = config.button1_pin;
const led = new Host.LED;

// Turn on LED upon wakeup
led.write(1);

// Check if retained values are valid
let valid = true;
for (let i = 0; i < 32; ++i) {
	let value = Sleep.getRetainedValue(i);
	if (i != value) {
		valid = false;
		break;
	}
}

// Blink LED to confirm retained values
if (valid) {
	for (let i = 0; i < 10; ++i) {
		led.write(0);
		Timer.delay(50);
		led.write(1);
		Timer.delay(50);
	}
	for (let i = 0; i < 32; ++i)
		Sleep.clearRetainedValue(i);
}

// Retain values and sleep
else {
	Timer.set(() => {
		Sleep.install(preSleep);
		Sleep.deep();
	}, 3000);
}

function preSleep() {
	led.write(0);
	for (let i = 0; i < 32; ++i)
		Sleep.setRetainedValue(i, i);
	Sleep.wakeOnDigital(wakeup_pin);
}
