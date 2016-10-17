(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vramework = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],4:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],5:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":3,"./encode":4}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":7,"punycode":2,"querystring":5}],7:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],8:[function(require,module,exports){
'use strict'
module.exports = chain

/**
 * Chain a stack of rill middleware into one composed function.
 *
 * @param {Array<Function>}
 * @return {Function}
 */
function chain (stack) {
  if (!Array.isArray(stack)) throw new TypeError('Rill: Middleware stack must be an array.')
  var fns = normalize(stack, [])

  return function chained (ctx, next) {
    var index = -1 // Last called middleware.
    return dispatch(0)
    function dispatch (i) {
      if (i <= index) return Promise.reject(new Error('Rill: next() called multiple times.'))

      var fn = fns[i] || next
      index = i

      if (!fn) {
        return Promise.resolve()
      }

      try {
        return Promise.resolve(fn(ctx, function next () {
          return dispatch(i + 1)
        }))
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}

/**
 * Utility to normalize a middleware stack and check for validity.
 *
 * @param {Array<Function>}
 * @throws {TypeError}
 */
function normalize (stack, fns) {
  var fn
  var len = stack.length
  for (var i = 0; i < len; i++) {
    fn = stack[i]
    if (!fn) continue
    else if (typeof fn === 'function') fns.push(fn)
    else if (Array.isArray(fn)) normalize(fn, fns)
    else if (Array.isArray(fn.stack)) normalize(fn.stack, fns)
    else throw new TypeError('Rill: Middleware must be an functions. Got a [' + fn.constructor.name + '].')
  }

  return fns
}

},{}],9:[function(require,module,exports){
'use strict'
var cookieReg = / *([^=;]+) *=? *([^;]+)?/g

/**
 * Parses a cookie string into an object.
 *
 * @param {String} cookie
 * @return {Object}
 */
exports.parse = function parse (cookie) {
  if (typeof cookie !== 'string') return {}

  var result = {}
  var m, key, val
  while ((m = cookieReg.exec(cookie))) {
    key = m[1]
    val = m[2]
    result[key] = val
      ? decodeURIComponent(val)
      : undefined
  }

  return result
}

/**
 * Seralize each cookie in an array into a cookie string.
 * Pull out valid options from an options object and return a string.
 *
 * @param {Object} opts
 * @return {Object}
 */
exports.serialize = function serialize (key, val, opts) {
  var result = [key + '=' + encodeURIComponent(val)]

  if (opts) {
    if (opts.domain) {
      result.push('domain=' + opts.domain)
    }
    if (opts.path) {
      result.push('path=' + opts.path)
    }
    if (opts.expires) {
      result.push('expires=' + (
        opts.expires.toUTCString
          ? opts.expires.toUTCString()
          : opts.expires
        ))
    }
    if (opts.maxAge) {
      result.push('max-age=' + (opts.maxAge | 0))
    }
    if (opts.httpOnly) {
      result.push('httponly')
    }
    if (opts.secure) {
      result.push('secure')
    }
  }

  return result.join('; ')
}

},{}],10:[function(require,module,exports){
'use strict'
var STATUS_CODES = require('@rill/http').STATUS_CODES
HttpError.prototype = new Error
HttpError.fail = fail
HttpError.assert = assert
module.exports = HttpError

/**
 * Creates a Rill HttpError.
 *
 * @param {String|Number} code - The status code for the error.
 * @param {String} [message] - Optional status message.
 * @param {Object} [meta] - Optional object to merge onto the error.
 */
function HttpError (code, message, meta) {
  if (typeof code !== 'number') throw new TypeError('Rill#HttpError.fail: Status code must be a number.')

  this.name = 'HttpError'
  this.code = code
  this.message = message || STATUS_CODES[code]

  for (var key in meta) this[key] = meta[key]
  if (Error.captureStackTrace) Error.captureStackTrace(this, HttpError)
  else Error.call(this)
}

/**
 * Throw an http error.
 *
 * @param {String|Number} code - The status code for the error.
 * @param {String} [message] - Optional status message.
 * @param {Object} [meta] - Optional object to merge onto the error.
 * @throws HttpError
 */
function fail (code, message, meta) {
  throw new HttpError(code, message, meta)
}

/**
 * Throw an http error if a value is not truthy.
 *
 * @param {*} val - The value to test for truthyness.
 * @param {String|Number} code - The status code for the error.
 * @param {String} [message] - Optional status message.
 * @param {Object} [meta] - Optional object to merge onto the error.
 * @throws HttpError
 */
function assert (val, code, message, meta) {
  if (!val) fail(code, message, meta)
}

},{"@rill/http":12}],11:[function(require,module,exports){
'use strict'

var URL = require('url')
var parseForm = require('parse-form')
var location = window.history.location || window.location
var relReg = /(?:^|\s+)external(?:\s+|$)/

module.exports = {
  onPopState: onPopState,
  onSubmit: onSubmit,
  onClick: onClick
}

/*
 * Handle an a pop state (back) event.
 */
function onPopState () {
  this.navigate(location.href, { popState: true })
}

/*
 * Handle intercepting forms to update the url.
 *
 * @param {Object} e
 */
function onSubmit (e) {
  // Ignore canceled events.
  if (e.defaultPrevented) return

  // Get the <form> element.
  var el = e.target
  var submitted = false
  var target = getAttribute(el, 'target')
  var action = getAttribute(el, 'action')
  var method = getAttribute(el, 'method').toUpperCase()
  var data = parseForm(el, true)

  // Ignore the click if the element has a target.
  if (target && target !== '_self') return

  if (method === 'GET') {
    // On a get request a forms body is converted into a query string.
    var parsed = URL.parse(URL.resolve(location.href, action))
    // We delete the search part so that a query object can be used.
    delete parsed.search
    parsed.query = data.body
    submitted = this.navigate(URL.format(parsed))
  } else {
    submitted = this.navigate({
      url: action,
      method: method,
      body: data.body,
      files: data.files,
      headers: { 'content-type': getAttribute(el, 'enctype') }
    })
  }

  if (submitted) {
    if (!el.hasAttribute('data-noreset')) el.reset()
    e.preventDefault()
  }
}

/*
 * Handle intercepting link clicks to update the url.
 *
 * @param {Object} e
 */
function onClick (e) {
  // Ignore canceled events, modified clicks, and right clicks.
  if (
    e.defaultPrevented ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.button !== 0
    ) return
  // Get the clicked element.
  var el = e.target

  // Check for submit button and ensure it has focus.
  // This fixes an issue with safari where buttons never get focus.
  // Fixes form submission parsing when using buttons with values.
  if (el.type === 'submit' && el !== document.activeElement) {
    el.focus()
    return
  }

  // Find an <a> element that may have been clicked.
  while (el != null && el.nodeName !== 'A') el = el.parentNode

  // Ignore if we couldn't find a link.
  if (!el) return

  var href = getAttribute(el, 'href')
  var target = getAttribute(el, 'target')
  var rel = getAttribute(el, 'rel')

  // Ignore clicks from linkless elements
  if (!href) return
  // Ignore the click if the element has a target.
  if (target && target !== '_self') return
  // Ignore 'rel="external"' links.
  if (relReg.test(rel)) return
  // Ignore downloadable links.
  if (el.hasAttribute('download')) return
  // Attempt to navigate internally.
  if (this.navigate(href)) e.preventDefault()
}

/*
 * Better get attribute with fall backs.
 * In some browsers default values like a forms method are not propigated to getAttribute.
 * This will check a forms attribute and properties.
 *
 * @param {HTMLEntiry} el
 * @param {String} attr
 * @return {String}
 */
function getAttribute (el, attr) {
  var val = el.getAttribute(attr) || el[attr]
  return typeof val === 'string' ? val : ''
}

},{"parse-form":23,"url":6}],12:[function(require,module,exports){
'use strict'

var Server = require('./server')
var IncomingMessage = require('./request.js')
var ServerResponse = require('./response.js')

var STATUS_CODES = require('statuses/codes.json')
var METHODS = [
  'CHECKOUT',
  'CONNECT',
  'COPY',
  'DELETE',
  'GET',
  'HEAD',
  'LOCK',
  'M-SEARCH',
  'MERGE',
  'MKACTIVITY',
  'MKCALENDAR',
  'MKCOL',
  'MOVE',
  'NOTIFY',
  'OPTIONS',
  'PATCH',
  'POST',
  'PROPFIND',
  'PROPPATCH',
  'PURGE',
  'PUT',
  'REPORT',
  'SEARCH',
  'SUBSCRIBE',
  'TRACE',
  'UNLOCK',
  'UNSUBSCRIBE'
]

module.exports = {
  STATUS_CODES: STATUS_CODES,
  METHODS: METHODS,
  Server: Server,
  IncomingMessage: IncomingMessage,
  ServerResponse: ServerResponse,
  createServer: function createServer () {
    var cb = arguments[arguments.length - 1]
    return new Server(cb)
  }
}

},{"./request.js":13,"./response.js":14,"./server":15,"statuses/codes.json":32}],13:[function(require,module,exports){
'use strict'

var EventEmitter = require('events').EventEmitter
var location = window.history.location || window.location

// TODO: Make options only the socket and manually set everything else.
// API Symmetry.
function IncomingMessage (opts) {
  this.url = opts.url
  this.method = opts.method || 'GET'
  this.headers = opts.headers || {}
  this.headers['referer'] = opts.referrer
  this.headers['date'] = (new Date()).toUTCString()
  this.headers['host'] = location.host
  this.headers['cookie'] = document.cookie
  this.headers['user-agent'] = navigator.userAgent
  this.headers['accept-language'] = navigator.language
  this.headers['connection'] = 'keep-alive'
  this.headers['cache-control'] = 'max-age=0'
  this.headers['accept'] = '*/*'
  this.connection = {
    remoteAddress: '127.0.0.1',
    encrypted: location.protocol === 'https:'
  }
  this.body = opts.body
  this.files = opts.files
}
var proto = IncomingMessage.prototype = Object.create(EventEmitter.prototype)

// Defaults
proto.httpVersionMajor = 1
proto.httpVersionMinor = 1
proto.httpVersion = proto.httpVersionMajor + '.' + proto.httpVersionMinor
proto.complete = false

module.exports = IncomingMessage

},{"events":1}],14:[function(require,module,exports){
'use strict'

var EventEmitter = require('events').EventEmitter
var STATUS_CODES = require('statuses/codes.json')
var noop = function () {}

function ServerResponse (opts) {
  this._headers = {}
}
var proto = ServerResponse.prototype = Object.create(EventEmitter.prototype)

// Defaults.
proto.statusCode = null
proto.statusMessage = null
proto.sendDate = true
proto.finished = false

/**
 * Make some methods noops.
 */
proto.write =
proto.writeContinue =
proto.setTimeout =
proto.addTrailers = noop

/**
 * Write status, status message and headers the same as node js.
 */
proto.writeHead = function writeHead (statusCode, statusMessage, headers) {
  if (this.finished) return

  this.statusCode = statusCode
  this.headersSent = true
  if (statusMessage) {
    if (typeof statusMessage === 'object') {
      headers = statusMessage
    } else {
      this.statusMessage = statusMessage
    }
  }

  if (typeof headers === 'object') {
    for (var key in headers) {
      this.setHeader(key, headers[key])
    }
  }
}

/**
 * Get a header the same as node js.
 */
proto.getHeader = function getHeader (header) {
  return this._headers[header.toLowerCase()]
}

/**
 * Remove a header the same as node js.
 */
proto.removeHeader = function removeHeader (header) {
  delete this._headers[header.toLowerCase()]
}

/**
 * Write a header the same as node js.
 */
proto.setHeader = function setHeader (header, value) {
  this._headers[header.toLowerCase()] = value
}

/**
 * Handle event ending the same as node js.
 */
proto.end = function end () {
  if (this.finished) return

  if (this.statusMessage == null) {
    this.statusMessage = STATUS_CODES[this.statusCode]
  }

  if (this.sendDate) {
    this._headers['date'] = (new Date()).toUTCString()
  }

  this._headers['status'] = this.statusCode
  this.headersSent = true
  this.finished = true
  this.emit('finish')
}

module.exports = ServerResponse

},{"events":1,"statuses/codes.json":32}],15:[function(require,module,exports){
'use strict'

var URL = require('url')
var EventEmitter = require('events').EventEmitter
var handlers = require('./handlers')
var Request = require('./request.js')
var Response = require('./response.js')
var history = window.history
var location = history.location || window.location
var hashReg = /#(.+)$/
var server = Server.prototype = Object.create(EventEmitter.prototype)
var referrer = document.referrer

/**
 * Emulates node js http server in the browser.
 *
 * @param {Function} handle - the handle for a request.
 */
function Server (handler) {
  this._handle = this
  this._pending_refresh = null
  if (handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('listener must be a function')
    }
    this.on('request', handler)
  }
}

/**
 * Listen to all url change events on a dom element and trigger the server callback.
 */
server.listen = function listen () {
  // Automatically add callback `listen` handler.
  var cb = arguments[arguments.length - 1]
  if (typeof cb === 'function') this.once('listening', cb)

  // Setup link/form hijackers.
  this._onPopState = handlers.onPopState.bind(this)
  this._onSubmit = handlers.onSubmit.bind(this)
  this._onClick = handlers.onClick.bind(this)

  // Setup initial load event and treat it as popstate.
  this.once('listening', this._onPopState)

  // Ensure that listening is `async`.
  setTimeout(function () {
    // Mark server as listening.
    this.listening = true
    this.emit('listening')
    // Register link/form hijackers.
    window.addEventListener('popstate', this._onPopState)
    window.addEventListener('submit', this._onSubmit)
    window.addEventListener('click', this._onClick)
  }.bind(this), 0)

  return this
}

/**
 * Closes the server and destroys all event listeners.
 */
server.close = function close () {
  // Automatically add callback `close` handler.
  var cb = arguments[arguments.length - 1]
  if (typeof cb === 'function') this.once('close', cb)

  // Ensure that closing is `async`.
  setTimeout(function () {
    // Unregister link/form hijackers.
    window.removeEventListener('popstate', this._onPopState)
    window.removeEventListener('submit', this._onSubmit)
    window.removeEventListener('click', this._onClick)
    // Mark server as closed.
    this.listening = false
    this.emit('close')
  }.bind(this), 0)

  return this
}

/*
 * Trigger the registered handle to navigate to a given url.
 *
 * @param {String|Object} req
 * @param {Object} opts
 * @param {Boolean} opts.popState
 * @api private
 */
server.navigate = function navigate (req, opts) {
  // Make options optional.
  if (typeof opts !== 'object') opts = {}
  // Allow navigation with url only.
  if (typeof req === 'string') req = { url: req }

  // Ignore links that don't share a protocol or host with the browsers.
  var href = URL.resolve(location.href, req.url)
  var parsed = URL.parse(href)
  // Ignore links for different hosts.
  if (parsed.host !== location.host) return false
  // Ignore links with a different protocol.
  if (parsed.protocol !== location.protocol) return false

  // Ensure that the url is nodejs like (starts with initial forward slash) but has the hash portion.
  req.url = parsed.path + (parsed.hash || '')
  // Attach referrer (stored on each request).
  req.referrer = referrer

  // Create a nodejs style req and res.
  req = new Request(req)
  var res = new Response()

  // Wait for request to be sent.
  res.once('finish', function onEnd () {
    // Node marks requests as complete.
    req.complete = true
    req.emit('end')

    // Any navigation during a 'refresh' will cancel the refresh.
    clearTimeout(this._pending_refresh)

    // Check if we should set some cookies.
    if (res.getHeader('set-cookie')) {
      var cookies = res.getHeader('set-cookie')
      if (Array.isArray(cookies)) {
        // Set multiple cookie header.
        cookies.forEach(function (cookie) { document.cookie = cookie })
      } else {
        // Set a single cookie.
        document.cookie = cookies
      }
    }

    // Check to see if a refresh was requested.
    if (res.getHeader('refresh')) {
      var parts = res.getHeader('refresh').split(' url=')
      var timeout = parseInt(parts[0]) * 1000
      var redirectURL = parts[1]
      // This handles refresh headers similar to browsers by waiting a timeout, then navigating.
      this._pending_refresh = setTimeout(
        this.navigate.bind(this, redirectURL),
        timeout
      )
    }

    // Check to see if we should redirect.
    if (res.getHeader('location')) {
      setTimeout(this.navigate.bind(this, res.getHeader('location')), 0)
      return
    }

    // Ensure referrer gets updated for non-redirects.
    referrer = href

    // We don't do hash scrolling unless it is a get request.
    if (req.method !== 'GET') return

    // popstate state is handled by the browser.
    if (opts.popState) return

    /*
     * When navigating a user will be brought to the top of the page.
     * If the urls contains a hash that is the id of an element (a target) then the target will be scrolled to.
     * This is similar to how browsers handle page transitions natively.
     */
    var hash = req.url.match(hashReg)
    if (hash == null) window.scrollTo(0, 0)
    else {
      var target = document.getElementById(hash[1])
      if (target) {
        target.scrollIntoView({
          block: 'start',
          // Only use smooth scrolling if we are on the page already.
          behavior: (
            location.pathname === parsed.pathname &&
            (location.search || '') === (parsed.search || '')
          ) ? 'smooth' : 'auto'
        })
      }
    }

    // Don't push the same url twice.
    if (req.headers.referer === req.url) return

    // Update the href in the browser.
    history.pushState(null, document.title, req.url)
  }.bind(this))

  this.emit('request', req, res)
  return this
}

module.exports = Server

},{"./handlers":11,"./request.js":13,"./response.js":14,"events":1,"url":6}],16:[function(require,module,exports){
"use strict";

module.exports = require("@rill/http");

},{"@rill/http":12}],17:[function(require,module,exports){
"use strict";

/*
 * Calculate the byte lengths for utf8 encoded strings.
 *
 * @param {String} str
 * @return {Number}
 */
module.exports = function byteLength (str) {
  var i, len;
  if (!str) return 0;
  str = str.toString();

  for (i = len = str.length; i--;) {
    var code = str[i].charCodeAt();
    if (0xDC00 <= code && code <= 0xDFFF) i--;
    if (0x7f < code && code <= 0x7ff) len++;
    else if (0x7ff < code && code <= 0xffff) len += 2;
  }

  return len;
};

},{}],18:[function(require,module,exports){
"use strict";

// Don't check buffer type in browser.
module.exports = {
	Buffer: function () {}
};

},{}],19:[function(require,module,exports){
"use strict";

// We won't bother loading mime-types in the browser.
module.exports = {
	lookup: function () {}
};

},{}],20:[function(require,module,exports){
"use strict";

var htmlReg = /^\s*</;
var buffer  = require("buffer").Buffer;
var lookup  = require("mime-types").lookup;

/**
 * Function that attempts to guess the content type for a value.
 *
 * Supports:
 * * text/plain
 * * text/html
 * * application/octet-stream
 * * application/json
 */
module.exports = function checkContent (data) {
	if (data == null || typeof data === "function") return;

	if (typeof data === "object") {
		if (isBuffer(data)) {
			return "application/octet-stream";
		} else if (isStream(data)) {
			return lookup(data.path) || "application/octet-stream";
		} else if (isJSON(data)) {
			return "application/json; charset=UTF-8";
		}
	}

	return "text/" + (
		htmlReg.test(String(data))
			? "html"
			: "plain"
	) + "; charset=UTF-8";
};

/**
 * Test if a value is a node buffer.
 */
function isBuffer (val) {
	return val instanceof buffer;
}

/**
 * Test if a value is a node stream.
 */
function isStream (val) {
	return typeof val.pipe === "function";
}

/**
 * Test if a value can be json.
 */
function isJSON (val) {
	// Try to check if JSON without stringify.
	if (
		typeof val.toJSON === "function" ||
		val.constructor === Object ||
		val.constructor === Array
	) return true;

	try {
		JSON.stringify(val);
		return true;
	} catch (_) {
		return false;
	}
}

},{"buffer":18,"mime-types":19}],21:[function(require,module,exports){
"use strict";

module.exports = field;

/**
 * Converts hyphenated headers like `Content-Type` into `content-type`.
 */
function field (str) {
	if (typeof str !== "string") throw new TypeError("Header Fields must be strings.");
	str = str.toLowerCase();
	if (str === "referrer") str = "referer";
	return str;
};

},{}],22:[function(require,module,exports){
(function (global){
'use strict'

var toString = Object.prototype.toString
var buffer = global.Buffer || noop
var typeClass = {
  string: '[object String]',
  number: '[object Number]',
  boolean: '[object Boolean]',
  date: '[object Date]',
  regexp: '[object RegExp]',
  error: '[object Error]',
  function: '[object Function]',
  arguments: '[object Arguments]',
  object: '[object Object]',
  array: '[object Array]'
}

module.exports = {
  string: isType('String'),
  number: isType('Number'),
  boolean: isType('Boolean'),
  date: isType('Date'),
  regexp: isType('RegExp'),
  error: isType('Error'),
  function: isType('Function'),
  arguments: isType('Arguments'),
  object: isType('Object'),
  array: isType('Array'),
  stream: function isStream (val) {
    return val != null && typeof val.pipe === 'function'
  },
  buffer: function isBuffer (val) {
    return val instanceof buffer
  },
  empty: function isEmpty (val) {
    /* eslint-disable */
    for (var key in val) return false
    /* eslint-enable */
    return true
  }
}

/**
 * Does nothing.
 */
function noop () {}

/*
 * Creates a type checker function based on the given type.
 *
 * @param {String} type
 * @api private
 */
function isType (name) {
  var type = name.toLowerCase()
  return function (val) {
    var _typeof = typeof val
    switch (_typeof) {
      case 'object':
      case 'function':
        return toString.call(val) === typeClass[type]
      default:
        return _typeof === type
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],23:[function(require,module,exports){
"use strict";

var qset      = require("q-set");
var fset      = qset.flat;
var temp      = [];
var validTags = {
	INPUT: true,
	TEXTAREA: true,
	SELECT: true,
	BUTTON: true
};

/*
 * Serialize a html form as JS object.
 *
 * @param {<Form/>} form
 * @returns { Array<Array> }
 */
module.exports = function FormJSON (form, flat) {
	if (!form || form.nodeName !== "FORM") {
		throw new Error("Can only parse form elements.");
	}

	var set         = flat ? fset : qset;
	var isMultiPart = form.enctype === "multipart/form-data";
	var elements    = form.elements;
	var body        = {};
	var files       = isMultiPart ? {} : undefined;
	var element;

	for (var i = 0, len = elements.length; i < len; i++) {
		element = elements[i];

		// Check if this element should be serialized.
		if (element.disabled || !(element.name && validTags[element.nodeName])) {
			continue;
		}

		var name    = element.name;
		var options = element.options;

		switch (element.type) {
			case "submit":
				// We check if the submit button is active
				// otherwise all type=submit buttons would be serialized.
				if (element === document.activeElement) set(body, name, element.value);
				break;
			case "checkbox":
			case "radio":
				if (element.checked) set(body, name, element.value);
				break;
			case "select-one":
				if (element.selectedIndex >= 0) set(body, name, options[element.selectedIndex].value);
				break;
			case "select-multiple":
				var selected = [];
				var option;
				for (var j = 0, _len = options.length; j < _len; j++) {
					option = options[j];
					if (option && option.selected) selected.push(option.value);
				}

				set(body, name, selected);
				break;
			case "file":
				var fileList = element.files;
				if (isMultiPart && fileList) {
					for (var _i = 0, _len = fileList.length; _i < _len; _i++) {
						set(files, name, fileList[_i]);
					}
				}
				break;
			default:
				set(body, name, element.value);
		}
	}

	return {
		body: body,
		files: files
	};
};

},{"q-set":26}],24:[function(require,module,exports){
var isarray = require('isarray')

/**
 * Expose `pathToRegexp`.
 */
module.exports = pathToRegexp
module.exports.parse = parse
module.exports.compile = compile
module.exports.tokensToFunction = tokensToFunction
module.exports.tokensToRegExp = tokensToRegExp

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */
function parse (str, options) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var defaultDelimiter = options && options.delimiter || '/'
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    var next = str[index]
    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var modifier = res[6]
    var asterisk = res[7]

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var partial = prefix != null && next != null && next !== prefix
    var repeat = modifier === '+' || modifier === '*'
    var optional = modifier === '?' || modifier === '*'
    var delimiter = res[2] || defaultDelimiter
    var pattern = capture || group

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      partial: partial,
      asterisk: !!asterisk,
      pattern: pattern ? escapeGroup(pattern) : (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?')
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */
function compile (str, options) {
  return tokensToFunction(parse(str, options))
}

/**
 * Prettier encoding of URI path segments.
 *
 * @param  {string}
 * @return {string}
 */
function encodeURIComponentPretty (str) {
  return encodeURI(str).replace(/[\/?#]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
 *
 * @param  {string}
 * @return {string}
 */
function encodeAsterisk (str) {
  return encodeURI(str).replace(/[?#]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$')
    }
  }

  return function (obj, opts) {
    var path = ''
    var data = obj || {}
    var options = opts || {}
    var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          // Prepend partial segment prefixes.
          if (token.partial) {
            path += token.prefix
          }

          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encode(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = token.asterisk ? encodeAsterisk(value) : encode(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {!RegExp} re
 * @param  {Array}   keys
 * @return {!RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {string}
 */
function flags (options) {
  return options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {!RegExp} path
 * @param  {!Array}  keys
 * @return {!RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g)

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        partial: false,
        asterisk: false,
        pattern: null
      })
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {!Array}  path
 * @param  {Array}   keys
 * @param  {!Object} options
 * @return {!RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = []

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source)
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {string}  path
 * @param  {!Array}  keys
 * @param  {!Object} options
 * @return {!RegExp}
 */
function stringToRegexp (path, keys, options) {
  return tokensToRegExp(parse(path, options), keys, options)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {!Array}          tokens
 * @param  {(Array|Object)=} keys
 * @param  {Object=}         options
 * @return {!RegExp}
 */
function tokensToRegExp (tokens, keys, options) {
  if (!isarray(keys)) {
    options = /** @type {!Object} */ (keys || options)
    keys = []
  }

  options = options || {}

  var strict = options.strict
  var end = options.end !== false
  var route = ''
  var lastToken = tokens[tokens.length - 1]
  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]

    if (typeof token === 'string') {
      route += escapeString(token)
    } else {
      var prefix = escapeString(token.prefix)
      var capture = '(?:' + token.pattern + ')'

      keys.push(token)

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*'
      }

      if (token.optional) {
        if (!token.partial) {
          capture = '(?:' + prefix + '(' + capture + '))?'
        } else {
          capture = prefix + '(' + capture + ')?'
        }
      } else {
        capture = prefix + '(' + capture + ')'
      }

      route += capture
    }
  }

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
  }

  if (end) {
    route += '$'
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
  }

  return attachKeys(new RegExp('^' + route, flags(options)), keys)
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(string|RegExp|Array)} path
 * @param  {(Array|Object)=}       keys
 * @param  {Object=}               options
 * @return {!RegExp}
 */
function pathToRegexp (path, keys, options) {
  if (!isarray(keys)) {
    options = /** @type {!Object} */ (keys || options)
    keys = []
  }

  options = options || {}

  if (path instanceof RegExp) {
    return regexpToRegexp(path, /** @type {!Array} */ (keys))
  }

  if (isarray(path)) {
    return arrayToRegexp(/** @type {!Array} */ (path), /** @type {!Array} */ (keys), options)
  }

  return stringToRegexp(/** @type {string} */ (path), /** @type {!Array} */ (keys), options)
}

},{"isarray":25}],25:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],26:[function(require,module,exports){
"use strict";

var matchArray   = /[^\[\]]+|\[\]/g;
var matchInteger = /^\d+$/;
var temp         = [];

/*
 * @description
 * A setter for querystring style fields like "a[b][c]".
 * The setter will create arrays for repeat keys.
 *
 * @param {Object} obj
 * @param {String} path
 * @param {*} val
 */
function qSet (obj, path, val) {
	var keys = path === "" ? [""] : path.match(matchArray);
	var len  = keys.length;
	var cur  = obj;
	var key, prev, next, exist;

	for (var i = 0; i < len; i++) {
		prev = cur;
		key  = keys[i];
		next = keys[i + 1];
		if (key === "[]") key = cur.length;
		// Make path as we go.
		cur = (exist = typeof cur === "object" && key in cur)
			? cur[key]
			// Check if the next path is an explicit array.
			: cur[key] = (next === "[]" || matchInteger.test(next))
				? []
				: {};
	}

	prev[key] = exist ? temp.concat(cur, val) : val;

	return obj;
};

/**
 * Like qset but doesn't resolve nested params such as a[b][c].
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 */
function fSet (obj, key, val) {
	key = arrayPushIndexes(obj, key);
	obj[key] = key in obj
		? temp.concat(obj[key], val)
		: val;
	return obj;
}

/**
 * Given a qs style key and an object will convert array push syntax to integers.
 * Eg: a[b][] -> a[b][0]
 *
 * @param {Object} obj
 * @param {String} key
 * @return {String}
 */
function arrayPushIndexes (obj, key) {
	var path = key.split("[]");
	if (path.length === 1) return key;
	var cur = path[0];
	var keys = Object.keys(obj);

	for (var i = 1, len = path.length; i < len; i++) {
		cur += "[" + findLastIndex(keys, cur) + "]" + path[i];
	}

	return cur;
}

/**
 * Given a path to push to will return the next valid index if possible.
 * Eg: a[b][] -> 0 // if array is empty.
 *
 * @param {Array} keys
 * @param {String} path
 * @return {Number}
 */
function findLastIndex (keys, path) {
	var last = -1;

	for (var key, i = keys.length; i--;) {
		key = keys[i];
		if (key.indexOf(path) !== 0) continue;
		key = key.replace(path, "");
		key = key.slice(1, key.indexOf("]"));
		if (key > last) last = Number(key);
	}

	return last + 1;
}

qSet.flat      = fSet;
module.exports = qSet;

},{}],27:[function(require,module,exports){
'use strict'

var HttpError = require('@rill/error')
var Request = require('./request')
var Response = require('./response')

module.exports = Context

/**
 * Creates an incomming message context.
 *
 * @constructor
 * @param {IncommingMessage} req - A nodejs style request object.
 * @param {ServerResponse} res - A nodejs style response object.
 */
function Context (req, res) {
  this.req = new Request(this, req)
  this.res = new Response(this, res)
  this.fail = this.fail.bind(this)
  this.assert = this.assert.bind(this)
  this.locals = {}
}
var context = Context.prototype

/**
 * Throw an http error.
 *
 * @param {String|Number} code - The status code for the error.
 * @param {String} [message] - Optional status message.
 * @param {Object} [meta] - Optional object to merge onto the error.
 * @throws HttpError
 */
context.fail = function throwHttp (code, message, meta) {
  if (typeof code !== 'number') throw new TypeError('Rill#ctx.fail: Status code must be a number.')
  var error = new HttpError(code, message, meta)
  this.res.status = error.code
  this.res.message = error.message
  throw error
}

/**
 * Throw an http error if a value is not truthy.
 *
 * @param {*} val - The value to test for truthyness.
 * @param {String|Number} code - The status code for the error.
 * @param {String} [message] - Optional status message.
 * @param {Object} [meta] - Optional object to merge onto the error.
 * @throws HttpError
 */
context.assert = function assertHttp (val, code, message, meta) {
  if (typeof code !== 'number') throw new TypeError('Rill#ctx.assert: Status code must be a number.')
  if (!val) this.fail(code, message, meta)
}

},{"./request":29,"./response":31,"@rill/error":10}],28:[function(require,module,exports){
'use strict'

var pathToRegExp = require('path-to-regexp')
var http = require('@rill/http')
var https = require('@rill/https')
var chain = require('@rill/chain')
var HttpError = require('@rill/error')
var Context = require('./context')
var respond = require('./respond')
var parse = pathToRegExp.parse
var tokensToRegExp = pathToRegExp.tokensToRegExp
var slice = Array.prototype.slice
var rill = Rill.prototype

module.exports = Rill.default = Rill

/**
 * Creates a universal app that will run middleware for a incomming request.
 *
 * @constructor
 */
function Rill () {
  if (!(this instanceof Rill)) return new Rill()
  this.stack = []
}

/**
 * Starts a node/rill server.
 *
 * @param {Object} [opts]
 * @param {String} opts.ip
 * @param {Number} opts.port
 * @param {Number} opts.backlog
 * @param {Object} opts.tls
 * @param {Function} cb
 * @return {Server}
 */
rill.listen = function listen (opts, cb) {
  // Make options optional.
  if (typeof opts === 'function') {
    cb = opts
    opts = null
  }

  opts = opts || {}
  opts.port = opts.port != null ? opts.port : null

  var server = (opts.tls)
    ? https.createServer(opts.tls, this.handler())
    : http.createServer(this.handler())

  return server.listen(opts.port, opts.ip, opts.backlog, cb)
}

/**
 * Takes the current middleware stack, chains it together and
 * returns a valid handler for a node js style server request.
 *
 * @return {Function}
 */
rill.handler = function handler () {
  var fn = chain(this.stack)
  return function handleIncommingMessage (req, res) {
    res.statusCode = 404
    var ctx = new Context(req, res)

    fn(ctx)
      .catch(handleError)
      .then(finish)

    function handleError (err) {
      if (Number(ctx.res.status) === 404) {
        ctx.res.status = 500
      }
      if (!(err instanceof HttpError)) {
        /* istanbul ignore next */
        console && console.error && console.error(err)
      }
    }

    function finish () { respond(ctx) }
  }
}

/**
 * Append new middleware to the current rill application stack.
 *
 * @example
 * rill.use(fn1, fn2)
 *
 * @param {Object} [config] - Optional config that must be matched for the middleware to run.
 * @param {Function...} middleware - Functions to run during an incomming request.
 */
rill.use = function use () {
  var start = this.stack.length
  var end = this.stack.length += arguments.length

  for (var i = end; start < i--;) {
    this.stack[i] = arguments[i - start]
  }

  return this
}

/**
 * Simple syntactic sugar for functions that
 * wish to modify the current rill instance.
 *
 * @param {Function...} transformers - Functions that will modify the rill instance.
 */
rill.setup = function setup () {
  for (var fn, len = arguments.length, i = 0; i < len; i++) {
    fn = arguments[i]
    if (!fn) continue
    if (typeof fn === 'function') fn(this)
    else throw new TypeError('Rill#setup: Setup must be a function or falsey.')
  }

  return this
}

/**
 * Use middleware at a specific pathname.
 */
rill.at = function at (pathname) {
  if (typeof pathname !== 'string') throw new TypeError('Rill#at: Path name must be a string.')

  var keys = []
  var reg = toReg(pathname, keys, { end: false, delimiter: '/' })
  var fn = chain(slice.call(arguments, 1))

  return this.use(function matchPathname (ctx, next) {
    var pathname = ctx.req.matchPath
    var matches = pathname.match(reg)
    // Check if we matched the whole path.
    if (!matches || matches[0] !== pathname) return next()

    // Check if params match.
    for (var key, match, i = keys.length; i--;) {
      key = keys[i]
      match = matches[i + 1]
      if (key.repeat) match = match == null ? [] : match.split('/')
      ctx.req.params[key.name] = match
    }

    // Update path for nested routes.
    var matched = matches[matches.length - 1] || ''
    if (ctx.req.matchPath !== matched) ctx.req.matchPath = '/' + matched

    // Run middleware.
    return fn(ctx, function () {
      // Reset nested pathname before calling later middleware.
      ctx.req.matchPath = pathname
      // Run sibling middleware.
      return next()
    })
  })
}

/**
 * Use middleware at a specific hostname.
 */
rill.host = function host (hostname) {
  if (typeof hostname !== 'string') throw new TypeError('Rill#host: Host name must be a string.')

  var keys = []
  var reg = toReg(hostname, keys, { strict: true, delimiter: '.' })
  var fn = chain(slice.call(arguments, 1))

  return this.use(function matchHost (ctx, next) {
    var hostname = ctx.req.matchHost
    var matches = hostname.match(reg)

    // Check if we matched the whole hostname.
    if (!matches || matches[0] !== hostname) return next()

    // Here we check for the dynamically matched subdomains.
    for (var key, match, i = keys.length; i--;) {
      key = keys[i]
      match = matches[i + 1]
      if (key.repeat) match = match == null ? [] : match.split('.')
      ctx.req.subdomains[key.name] = match
    }

    // Update hostname for nested routes.
    var matched = matches[matches.length - 1] || ''
    if (ctx.req.matchHost !== matched) ctx.req.matchHost = matched

    // Run middleware.
    return fn(ctx, function () {
      // Reset nested hostname.
      ctx.req.matchHost = hostname
      // Run sibling middleware.
      return next()
    })
  })
}

/**
 * Use middleware for a specific method / pathname.
 */
http.METHODS.forEach(function (method) {
  var name = method.toLowerCase()
  rill[name] = function (pathname) {
    var offset = typeof pathname === 'string' ? 1 : 0
    var fn = chain(slice.call(arguments, offset))
    if (offset === 1) return this.at(pathname, matchMethod)
    return this.use(matchMethod)

    function matchMethod (ctx, next) {
      if (ctx.req.method !== method) return next()
      return fn(ctx, next)
    }
  }
})

/**
 * Small wrapper around path to regexp that treats a splat param "/*" as optional.
 * This makes mounting easier since typically when you do a path like "/test/*" you also want to treat "/test" as valid.
 *
 * @param {String} pathname - the path to convert to a regexp.
 * @param {Array} [keys] - a place to store matched param keys.
 * @param {Object} [opts] - options passed to pathToRegExp.
 * @return {RegExp}
 */
function toReg (pathname, keys, opts) {
  // First parse path into tokens.
  var tokens = parse(pathname)

  // Find the last token (checking for splat params).
  var splat = tokens[tokens.length - 1]

  // Check if the last token is a splat and make it optional.
  if (splat && splat.asterisk) splat.optional = true

  // Convert the tokens to a regexp.
  var re = tokensToRegExp(tokens, opts)

  // Assign keys to from regexp.
  re.keys = keys
  for (var i = 0, len = tokens.length; i < len; i++) {
    if (typeof tokens[i] === 'object') keys.push(tokens[i])
  }

  return re
}

},{"./context":27,"./respond":30,"@rill/chain":8,"@rill/error":10,"@rill/http":12,"@rill/https":16,"path-to-regexp":24}],29:[function(require,module,exports){
'use strict'

var URL = require('url')
var qSet = require('q-set')
var toField = require('header-field')
var cookies = require('@rill/cookies')

module.exports = Request

/**
 * Wrapper around nodejs `IncommingMessage` that has pre parsed url
 * and other conveinences.
 *
 * @constructor
 * @param {Context} ctx - The context for the request.
 * @param {IncommingMessage} req - The original node request.
 */
function Request (ctx, req) {
  var host = req.headers['host']
  var protocol = (req.connection.encrypted) ? 'https' : 'http'
  var parsed = URL.parse(protocol + '://' + host + req.url, true)
  this.ctx = ctx
  this.original = req
  this.method = req.method
  this.headers = req.headers
  this.cookies = cookies.parse(this.headers['cookie'])
  this.params = {}
  this.href = parsed.href
  this.protocol = protocol
  this.port = parsed.port
  this.host = parsed.host
  this.hostname = this.matchHost = parsed.hostname
  this.path = parsed.path
  this.pathname = this.matchPath = parsed.pathname
  this.search = parsed.search
  this.hash = parsed.hash
  this.query = {}
  this.origin = this.protocol + '://' + this.host
  this.secure = this.protocol === 'https'
  this.subdomains = String(this.hostname).split('.').reverse().slice(2)
  /* istanbul ignore next */
  this.ip = (
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket && req.connection.socket.remoteAddress)
  )

  // Support nested querystrings.
  var query = parsed.query
  for (var key in query) qSet(this.query, key, query[key])
}
var request = Request.prototype

/**
 * Utility to retrieve a header for the request.
 *
 * @param {String} field
 * @return {Array|String}
 */
request.get = function get (field) {
  return this.headers[toField(field)]
}

},{"@rill/cookies":9,"header-field":21,"q-set":26,"url":6}],30:[function(require,module,exports){
'use strict'

var byteLength = require('byte-length')
var checkType = require('content-check')
var statuses = require('statuses')
var isType = require('is-typeof')

module.exports = respond

/**
 * Runs general clean up on a request and ends it.
 */
function respond (ctx) {
  var req = ctx.req
  var res = ctx.res
  var body = res.body
  var original = res.original
  var isStream = isType.stream(body)
  var isBuffer = isType.buffer(body)

  // Allow skipping response.
  if (res.respond === false) return
  // Skip request ended externally.
  if (original.headersSent) return

  // Apply default statuses.
  if (Number(res.status) === 404) {
    // Ensure redirect status.
    if (res.get('Location')) res.status = 302
    // Default the status to 200 if there is substance to the response.
    else if (body) res.status = 200
  }

  // Default status message based on status code.
  res.message = res.message || statuses[res.status]

  // Ensure no content-type for empty responses.
  if (req.method === 'HEAD' || statuses.empty[res.status] || !body) {
    body = null
    res.remove('Content-Type')
    res.remove('Content-Length')
  } else {
    // Attempt to guess content type.
    if (!res.get('Content-Type')) res.set('Content-Type', checkType(body))
    // Stringify objects that are not buffers.
    if (typeof body === 'object' && !isStream && !isBuffer) body = JSON.stringify(body)
    // Attempt to guess content-length.
    if (!res.get('Content-Length') && !isStream) res.set('Content-Length', byteLength(body))
  }

  // Send off headers.
  original.writeHead(res.status, res.message, clean(res.headers))
  // Allow for requests to stay open.
  if (res.end === false) return
  // Finish response.
  if (isStream) body.pipe(original)
  else original.end(body)
}

/**
 * Utility to remove empty values from an object.
 *
 * @param {Object} obj
 * @return {Object}
 */
function clean (obj) {
  for (var key in obj) {
    if (obj[key] == null || obj[key].length === 0) {
      delete obj[key]
    }
  }
  return obj
}

},{"byte-length":17,"content-check":20,"is-typeof":22,"statuses":33}],31:[function(require,module,exports){
'use strict'

var URL = require('url')
var statuses = require('statuses')
var toField = require('header-field')
var cookies = require('@rill/cookies')

module.exports = Response

/**
 * Wrapper around nodejs `ServerResponse`.
 *
 * @constructor
 * @param {Context} ctx - The context for the request.
 * @param {ServerResponse} res - The original node response.
 */
function Response (ctx, res) {
  this.ctx = ctx
  this.original = res
  this.status = res.statusCode
  this.body = undefined
  this.headers = {}
  res.once('finish', function () { ctx.res.finished = true })
}
var response = Response.prototype

/**
 * Appends to the current set-cookie header, adding a new cookie with options.
 *
 * @param {String} key - the name of the cookie.
 * @param {*} val - the value for the cookie.
 * @param {Object} opts - options for the cookie.
 */
response.cookie = function (key, val, opts) {
  this.append('Set-Cookie', cookies.serialize(key, val, opts))
}

/**
 * Deletes a cookie.
 *
 * @param {String} key - the name of the cookie.
 * @param {Object} opts - options for the cookie.
 */
response.clearCookie = function (key, opts) {
  opts = opts || {}
  opts.expires = new Date()
  this.append('Set-Cookie', cookies.serialize(key, '', opts))
}

/**
 * Attaches relative location headers to perform a redirect.
 * Will redirect to the referrer if "back" is supplied as a url.
 *
 * @param {String} url - The url to redirect too or "back".
 * @param {String} alt - Used if the url is empty or "back" does not exist.
 */
response.redirect = function redirect (url, alt) {
  var req = this.ctx.req

  // Back uses request referrer header as a url.
  url = (url === 'back') ? req.get('Referrer') : url
  // Default url to alternative.
  url = url || alt

  if (!url) {
    throw new TypeError('Rill#ctx.res.redirect: Cannot redirect, url not specified and alternative not provided.')
  }

  if (!statuses.redirect[this.status]) this.status = 302

  this.set('Location', URL.resolve(req.href, url))
}

/**
 * Attaches relative refresh headers to perform a timed refresh.
 * Will refresh to the referrer if "back" is supplied as a url.
 *
 * @param {String} delay - Delays the refresh by `delay` seconds.
 * @param {String} url - The url to refresh or "back".
 * @param {String} alt - Used if the url is empty or "back" does not exist.
 */
response.refresh = function refresh (delay, url, alt) {
  var req = this.ctx.req

  delay = delay || 0
  // Back uses request referrer header as a url.
  url = (url === 'back') ? req.get('Referrer') : url
  // Default url to alternative.
  url = url || alt || req.href

  this.set('Refresh', delay + '; url=' + URL.resolve(req.href, url))
}

/**
 * Utility to retrieve a header for the response.
 *
 * @param {String} field
 * @return {Array|String}
 */
response.get = function get (field) {
  return this.headers[toField(field)]
}

/**
 * Utility to set a header for the response.
 *
 * @param {String} field
 * @param {Array|String} val
 */
response.set = function set (field, val) {
  this.headers[toField(field)] = val
}

/**
 * Utility to append to an existing header for the response.
 *
 * @param {String} field
 * @param {Array|String} val
 */
response.append = function append (field, val) {
  field = toField(field)
  var headers = this.headers
  var cur = this.headers[field]

  if (cur == null) cur = []
  else if (!Array.isArray(cur)) cur = [cur]

  headers[field] = cur.concat(val)
}

/**
 * Utility to delete an existing header on the response.
 *
 * @param {String} field
 */
response.remove = function remove (field) {
  delete this.headers[toField(field)]
}

},{"@rill/cookies":9,"header-field":21,"statuses":33,"url":6}],32:[function(require,module,exports){
module.exports={
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "208": "Already Reported",
  "226": "IM Used",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Found",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "306": "(Unused)",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Payload Too Large",
  "414": "URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "421": "Misdirected Request",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Unordered Collection",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "451": "Unavailable For Legal Reasons",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "508": "Loop Detected",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
}
},{}],33:[function(require,module,exports){
/*!
 * statuses
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2016 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var codes = require('./codes.json')

/**
 * Module exports.
 * @public
 */

module.exports = status

// array of status codes
status.codes = populateStatusesMap(status, codes)

// status codes for redirects
status.redirect = {
  300: true,
  301: true,
  302: true,
  303: true,
  305: true,
  307: true,
  308: true
}

// status codes for empty bodies
status.empty = {
  204: true,
  205: true,
  304: true
}

// status codes for when you should retry the request
status.retry = {
  502: true,
  503: true,
  504: true
}

/**
 * Populate the statuses map for given codes.
 * @private
 */

function populateStatusesMap (statuses, codes) {
  var arr = []

  Object.keys(codes).forEach(function forEachCode (code) {
    var message = codes[code]
    var status = Number(code)

    // Populate properties
    statuses[status] = message
    statuses[message] = status
    statuses[message.toLowerCase()] = status

    // Add to array
    arr.push(status)
  })

  return arr
}

/**
 * Get the status code.
 *
 * Given a number, this will throw if it is not a known status
 * code, otherwise the code will be returned. Given a string,
 * the string will be parsed for a number and return the code
 * if valid, otherwise will lookup the code assuming this is
 * the status message.
 *
 * @param {string|number} code
 * @returns {string}
 * @public
 */

function status (code) {
  if (typeof code === 'number') {
    if (!status[code]) throw new Error('invalid status code: ' + code)
    return code
  }

  if (typeof code !== 'string') {
    throw new TypeError('code must be a number or string')
  }

  // '403'
  var n = parseInt(code, 10)
  if (!isNaN(n)) {
    if (!status[n]) throw new Error('invalid status code: ' + n)
    return n
  }

  n = status[code.toLowerCase()]
  if (!n) throw new Error('invalid status message: "' + code + '"')
  return n
}

},{"./codes.json":32}],34:[function(require,module,exports){
var isNode=new Function("try {return this===global;}catch(e){return false;}"),
    Rill = require('rill'),
    app = new Rill();
console.log(app)
var vramework = {
    use: function() {
        return app.use.apply(app, arguments);
    },
    get: function() {
        return app.get.apply(app, arguments);
    },
    use: function() {
        return app.use.apply(app, arguments);
    }
}

module.exports = vramework;
},{"rill":28}]},{},[34])(34)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6L1VzZXJzL01pY2hhZWwgS2xlaW4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiQzovVXNlcnMvTWljaGFlbCBLbGVpbi9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiQzovVXNlcnMvTWljaGFlbCBLbGVpbi9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wdW55Y29kZS9wdW55Y29kZS5qcyIsIkM6L1VzZXJzL01pY2hhZWwgS2xlaW4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2RlY29kZS5qcyIsIkM6L1VzZXJzL01pY2hhZWwgS2xlaW4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2VuY29kZS5qcyIsIkM6L1VzZXJzL01pY2hhZWwgS2xlaW4vQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2luZGV4LmpzIiwiQzovVXNlcnMvTWljaGFlbCBLbGVpbi9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91cmwvdXJsLmpzIiwiQzovVXNlcnMvTWljaGFlbCBLbGVpbi9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91cmwvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9AcmlsbC9jaGFpbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AcmlsbC9jb29raWVzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL2Vycm9yL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL2h0dHAvY2xpZW50L2hhbmRsZXJzLmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL2h0dHAvY2xpZW50L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL2h0dHAvY2xpZW50L3JlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvQHJpbGwvaHR0cC9jbGllbnQvcmVzcG9uc2UuanMiLCJub2RlX21vZHVsZXMvQHJpbGwvaHR0cC9jbGllbnQvc2VydmVyLmpzIiwibm9kZV9tb2R1bGVzL0ByaWxsL2h0dHBzL2NsaWVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ieXRlLWxlbmd0aC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jb250ZW50LWNoZWNrL2Jyb3dzZXIvYnVmZmVyLmpzIiwibm9kZV9tb2R1bGVzL2NvbnRlbnQtY2hlY2svYnJvd3Nlci9taW1lLXR5cGVzLmpzIiwibm9kZV9tb2R1bGVzL2NvbnRlbnQtY2hlY2svaW5kZXguanMiLCJub2RlX21vZHVsZXMvaGVhZGVyLWZpZWxkL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2lzLXR5cGVvZi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wYXJzZS1mb3JtL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3BhdGgtdG8tcmVnZXhwL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3BhdGgtdG8tcmVnZXhwL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Etc2V0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3JpbGwvc3JjL2NvbnRleHQuanMiLCJub2RlX21vZHVsZXMvcmlsbC9zcmMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcmlsbC9zcmMvcmVxdWVzdC5qcyIsIm5vZGVfbW9kdWxlcy9yaWxsL3NyYy9yZXNwb25kLmpzIiwibm9kZV9tb2R1bGVzL3JpbGwvc3JjL3Jlc3BvbnNlLmpzIiwibm9kZV9tb2R1bGVzL3N0YXR1c2VzL2NvZGVzLmpzb24iLCJub2RlX21vZHVsZXMvc3RhdHVzZXMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzlTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNyaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzV0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTUE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3phQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEF0IGxlYXN0IGdpdmUgc29tZSBraW5kIG9mIGNvbnRleHQgdG8gdGhlIHVzZXJcbiAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcgKyBlciArICcpJyk7XG4gICAgICAgIGVyci5jb250ZXh0ID0gZXI7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiLyohIGh0dHBzOi8vbXRocy5iZS9wdW55Y29kZSB2MS40LjEgYnkgQG1hdGhpYXMgKi9cbjsoZnVuY3Rpb24ocm9vdCkge1xuXG5cdC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZXMgKi9cblx0dmFyIGZyZWVFeHBvcnRzID0gdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcgJiYgZXhwb3J0cyAmJlxuXHRcdCFleHBvcnRzLm5vZGVUeXBlICYmIGV4cG9ydHM7XG5cdHZhciBmcmVlTW9kdWxlID0gdHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiZcblx0XHQhbW9kdWxlLm5vZGVUeXBlICYmIG1vZHVsZTtcblx0dmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcblx0aWYgKFxuXHRcdGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8XG5cdFx0ZnJlZUdsb2JhbC53aW5kb3cgPT09IGZyZWVHbG9iYWwgfHxcblx0XHRmcmVlR2xvYmFsLnNlbGYgPT09IGZyZWVHbG9iYWxcblx0KSB7XG5cdFx0cm9vdCA9IGZyZWVHbG9iYWw7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwdW55Y29kZWAgb2JqZWN0LlxuXHQgKiBAbmFtZSBwdW55Y29kZVxuXHQgKiBAdHlwZSBPYmplY3Rcblx0ICovXG5cdHZhciBwdW55Y29kZSxcblxuXHQvKiogSGlnaGVzdCBwb3NpdGl2ZSBzaWduZWQgMzItYml0IGZsb2F0IHZhbHVlICovXG5cdG1heEludCA9IDIxNDc0ODM2NDcsIC8vIGFrYS4gMHg3RkZGRkZGRiBvciAyXjMxLTFcblxuXHQvKiogQm9vdHN0cmluZyBwYXJhbWV0ZXJzICovXG5cdGJhc2UgPSAzNixcblx0dE1pbiA9IDEsXG5cdHRNYXggPSAyNixcblx0c2tldyA9IDM4LFxuXHRkYW1wID0gNzAwLFxuXHRpbml0aWFsQmlhcyA9IDcyLFxuXHRpbml0aWFsTiA9IDEyOCwgLy8gMHg4MFxuXHRkZWxpbWl0ZXIgPSAnLScsIC8vICdcXHgyRCdcblxuXHQvKiogUmVndWxhciBleHByZXNzaW9ucyAqL1xuXHRyZWdleFB1bnljb2RlID0gL154bi0tLyxcblx0cmVnZXhOb25BU0NJSSA9IC9bXlxceDIwLVxceDdFXS8sIC8vIHVucHJpbnRhYmxlIEFTQ0lJIGNoYXJzICsgbm9uLUFTQ0lJIGNoYXJzXG5cdHJlZ2V4U2VwYXJhdG9ycyA9IC9bXFx4MkVcXHUzMDAyXFx1RkYwRVxcdUZGNjFdL2csIC8vIFJGQyAzNDkwIHNlcGFyYXRvcnNcblxuXHQvKiogRXJyb3IgbWVzc2FnZXMgKi9cblx0ZXJyb3JzID0ge1xuXHRcdCdvdmVyZmxvdyc6ICdPdmVyZmxvdzogaW5wdXQgbmVlZHMgd2lkZXIgaW50ZWdlcnMgdG8gcHJvY2VzcycsXG5cdFx0J25vdC1iYXNpYyc6ICdJbGxlZ2FsIGlucHV0ID49IDB4ODAgKG5vdCBhIGJhc2ljIGNvZGUgcG9pbnQpJyxcblx0XHQnaW52YWxpZC1pbnB1dCc6ICdJbnZhbGlkIGlucHV0J1xuXHR9LFxuXG5cdC8qKiBDb252ZW5pZW5jZSBzaG9ydGN1dHMgKi9cblx0YmFzZU1pbnVzVE1pbiA9IGJhc2UgLSB0TWluLFxuXHRmbG9vciA9IE1hdGguZmxvb3IsXG5cdHN0cmluZ0Zyb21DaGFyQ29kZSA9IFN0cmluZy5mcm9tQ2hhckNvZGUsXG5cblx0LyoqIFRlbXBvcmFyeSB2YXJpYWJsZSAqL1xuXHRrZXk7XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBlcnJvciB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSBUaGUgZXJyb3IgdHlwZS5cblx0ICogQHJldHVybnMge0Vycm9yfSBUaHJvd3MgYSBgUmFuZ2VFcnJvcmAgd2l0aCB0aGUgYXBwbGljYWJsZSBlcnJvciBtZXNzYWdlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZXJyb3IodHlwZSkge1xuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKGVycm9yc1t0eXBlXSk7XG5cdH1cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGBBcnJheSNtYXBgIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBpdGVyYXRlIG92ZXIuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0aGF0IGdldHMgY2FsbGVkIGZvciBldmVyeSBhcnJheVxuXHQgKiBpdGVtLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IGFycmF5IG9mIHZhbHVlcyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXAoYXJyYXksIGZuKSB7XG5cdFx0dmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcblx0XHR2YXIgcmVzdWx0ID0gW107XG5cdFx0d2hpbGUgKGxlbmd0aC0tKSB7XG5cdFx0XHRyZXN1bHRbbGVuZ3RoXSA9IGZuKGFycmF5W2xlbmd0aF0pO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgc2ltcGxlIGBBcnJheSNtYXBgLWxpa2Ugd3JhcHBlciB0byB3b3JrIHdpdGggZG9tYWluIG5hbWUgc3RyaW5ncyBvciBlbWFpbFxuXHQgKiBhZGRyZXNzZXMuXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0aGF0IGdldHMgY2FsbGVkIGZvciBldmVyeVxuXHQgKiBjaGFyYWN0ZXIuXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgc3RyaW5nIG9mIGNoYXJhY3RlcnMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrXG5cdCAqIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwRG9tYWluKHN0cmluZywgZm4pIHtcblx0XHR2YXIgcGFydHMgPSBzdHJpbmcuc3BsaXQoJ0AnKTtcblx0XHR2YXIgcmVzdWx0ID0gJyc7XG5cdFx0aWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcblx0XHRcdC8vIEluIGVtYWlsIGFkZHJlc3Nlcywgb25seSB0aGUgZG9tYWluIG5hbWUgc2hvdWxkIGJlIHB1bnljb2RlZC4gTGVhdmVcblx0XHRcdC8vIHRoZSBsb2NhbCBwYXJ0IChpLmUuIGV2ZXJ5dGhpbmcgdXAgdG8gYEBgKSBpbnRhY3QuXG5cdFx0XHRyZXN1bHQgPSBwYXJ0c1swXSArICdAJztcblx0XHRcdHN0cmluZyA9IHBhcnRzWzFdO1xuXHRcdH1cblx0XHQvLyBBdm9pZCBgc3BsaXQocmVnZXgpYCBmb3IgSUU4IGNvbXBhdGliaWxpdHkuIFNlZSAjMTcuXG5cdFx0c3RyaW5nID0gc3RyaW5nLnJlcGxhY2UocmVnZXhTZXBhcmF0b3JzLCAnXFx4MkUnKTtcblx0XHR2YXIgbGFiZWxzID0gc3RyaW5nLnNwbGl0KCcuJyk7XG5cdFx0dmFyIGVuY29kZWQgPSBtYXAobGFiZWxzLCBmbikuam9pbignLicpO1xuXHRcdHJldHVybiByZXN1bHQgKyBlbmNvZGVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYW4gYXJyYXkgY29udGFpbmluZyB0aGUgbnVtZXJpYyBjb2RlIHBvaW50cyBvZiBlYWNoIFVuaWNvZGVcblx0ICogY2hhcmFjdGVyIGluIHRoZSBzdHJpbmcuIFdoaWxlIEphdmFTY3JpcHQgdXNlcyBVQ1MtMiBpbnRlcm5hbGx5LFxuXHQgKiB0aGlzIGZ1bmN0aW9uIHdpbGwgY29udmVydCBhIHBhaXIgb2Ygc3Vycm9nYXRlIGhhbHZlcyAoZWFjaCBvZiB3aGljaFxuXHQgKiBVQ1MtMiBleHBvc2VzIGFzIHNlcGFyYXRlIGNoYXJhY3RlcnMpIGludG8gYSBzaW5nbGUgY29kZSBwb2ludCxcblx0ICogbWF0Y2hpbmcgVVRGLTE2LlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmVuY29kZWBcblx0ICogQHNlZSA8aHR0cHM6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGRlY29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nIFRoZSBVbmljb2RlIGlucHV0IHN0cmluZyAoVUNTLTIpLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBuZXcgYXJyYXkgb2YgY29kZSBwb2ludHMuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cmluZykge1xuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgY291bnRlciA9IDAsXG5cdFx0ICAgIGxlbmd0aCA9IHN0cmluZy5sZW5ndGgsXG5cdFx0ICAgIHZhbHVlLFxuXHRcdCAgICBleHRyYTtcblx0XHR3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0dmFsdWUgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHQvLyBoaWdoIHN1cnJvZ2F0ZSwgYW5kIHRoZXJlIGlzIGEgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0ZXh0cmEgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHsgLy8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKCgodmFsdWUgJiAweDNGRikgPDwgMTApICsgKGV4dHJhICYgMHgzRkYpICsgMHgxMDAwMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHQvLyBjb2RlIHVuaXQgaXMgdGhlIGhpZ2ggc3Vycm9nYXRlIG9mIGEgc3Vycm9nYXRlIHBhaXJcblx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHN0cmluZyBiYXNlZCBvbiBhbiBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmRlY29kZWBcblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZW5jb2RlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvZGVQb2ludHMgVGhlIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBuZXcgVW5pY29kZSBzdHJpbmcgKFVDUy0yKS5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJlbmNvZGUoYXJyYXkpIHtcblx0XHRyZXR1cm4gbWFwKGFycmF5LCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdFx0aWYgKHZhbHVlID4gMHhGRkZGKSB7XG5cdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApO1xuXHRcdFx0XHR2YWx1ZSA9IDB4REMwMCB8IHZhbHVlICYgMHgzRkY7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBiYXNpYyBjb2RlIHBvaW50IGludG8gYSBkaWdpdC9pbnRlZ2VyLlxuXHQgKiBAc2VlIGBkaWdpdFRvQmFzaWMoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvZGVQb2ludCBUaGUgYmFzaWMgbnVtZXJpYyBjb2RlIHBvaW50IHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQgKGZvciB1c2UgaW5cblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpbiB0aGUgcmFuZ2UgYDBgIHRvIGBiYXNlIC0gMWAsIG9yIGBiYXNlYCBpZlxuXHQgKiB0aGUgY29kZSBwb2ludCBkb2VzIG5vdCByZXByZXNlbnQgYSB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGJhc2ljVG9EaWdpdChjb2RlUG9pbnQpIHtcblx0XHRpZiAoY29kZVBvaW50IC0gNDggPCAxMCkge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDIyO1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gNjUgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDY1O1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gOTcgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDk3O1xuXHRcdH1cblx0XHRyZXR1cm4gYmFzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGRpZ2l0L2ludGVnZXIgaW50byBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEBzZWUgYGJhc2ljVG9EaWdpdCgpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGlnaXQgVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYmFzaWMgY29kZSBwb2ludCB3aG9zZSB2YWx1ZSAod2hlbiB1c2VkIGZvclxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGlzIGBkaWdpdGAsIHdoaWNoIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZVxuXHQgKiBgMGAgdG8gYGJhc2UgLSAxYC4gSWYgYGZsYWdgIGlzIG5vbi16ZXJvLCB0aGUgdXBwZXJjYXNlIGZvcm0gaXNcblx0ICogdXNlZDsgZWxzZSwgdGhlIGxvd2VyY2FzZSBmb3JtIGlzIHVzZWQuIFRoZSBiZWhhdmlvciBpcyB1bmRlZmluZWRcblx0ICogaWYgYGZsYWdgIGlzIG5vbi16ZXJvIGFuZCBgZGlnaXRgIGhhcyBubyB1cHBlcmNhc2UgZm9ybS5cblx0ICovXG5cdGZ1bmN0aW9uIGRpZ2l0VG9CYXNpYyhkaWdpdCwgZmxhZykge1xuXHRcdC8vICAwLi4yNSBtYXAgdG8gQVNDSUkgYS4ueiBvciBBLi5aXG5cdFx0Ly8gMjYuLjM1IG1hcCB0byBBU0NJSSAwLi45XG5cdFx0cmV0dXJuIGRpZ2l0ICsgMjIgKyA3NSAqIChkaWdpdCA8IDI2KSAtICgoZmxhZyAhPSAwKSA8PCA1KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCaWFzIGFkYXB0YXRpb24gZnVuY3Rpb24gYXMgcGVyIHNlY3Rpb24gMy40IG9mIFJGQyAzNDkyLlxuXHQgKiBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzQ5MiNzZWN0aW9uLTMuNFxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0ZnVuY3Rpb24gYWRhcHQoZGVsdGEsIG51bVBvaW50cywgZmlyc3RUaW1lKSB7XG5cdFx0dmFyIGsgPSAwO1xuXHRcdGRlbHRhID0gZmlyc3RUaW1lID8gZmxvb3IoZGVsdGEgLyBkYW1wKSA6IGRlbHRhID4+IDE7XG5cdFx0ZGVsdGEgKz0gZmxvb3IoZGVsdGEgLyBudW1Qb2ludHMpO1xuXHRcdGZvciAoLyogbm8gaW5pdGlhbGl6YXRpb24gKi87IGRlbHRhID4gYmFzZU1pbnVzVE1pbiAqIHRNYXggPj4gMTsgayArPSBiYXNlKSB7XG5cdFx0XHRkZWx0YSA9IGZsb29yKGRlbHRhIC8gYmFzZU1pbnVzVE1pbik7XG5cdFx0fVxuXHRcdHJldHVybiBmbG9vcihrICsgKGJhc2VNaW51c1RNaW4gKyAxKSAqIGRlbHRhIC8gKGRlbHRhICsgc2tldykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scyB0byBhIHN0cmluZyBvZiBVbmljb2RlXG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGRlY29kZShpbnB1dCkge1xuXHRcdC8vIERvbid0IHVzZSBVQ1MtMlxuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgaW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGgsXG5cdFx0ICAgIG91dCxcblx0XHQgICAgaSA9IDAsXG5cdFx0ICAgIG4gPSBpbml0aWFsTixcblx0XHQgICAgYmlhcyA9IGluaXRpYWxCaWFzLFxuXHRcdCAgICBiYXNpYyxcblx0XHQgICAgaixcblx0XHQgICAgaW5kZXgsXG5cdFx0ICAgIG9sZGksXG5cdFx0ICAgIHcsXG5cdFx0ICAgIGssXG5cdFx0ICAgIGRpZ2l0LFxuXHRcdCAgICB0LFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgYmFzZU1pbnVzVDtcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHM6IGxldCBgYmFzaWNgIGJlIHRoZSBudW1iZXIgb2YgaW5wdXQgY29kZVxuXHRcdC8vIHBvaW50cyBiZWZvcmUgdGhlIGxhc3QgZGVsaW1pdGVyLCBvciBgMGAgaWYgdGhlcmUgaXMgbm9uZSwgdGhlbiBjb3B5XG5cdFx0Ly8gdGhlIGZpcnN0IGJhc2ljIGNvZGUgcG9pbnRzIHRvIHRoZSBvdXRwdXQuXG5cblx0XHRiYXNpYyA9IGlucHV0Lmxhc3RJbmRleE9mKGRlbGltaXRlcik7XG5cdFx0aWYgKGJhc2ljIDwgMCkge1xuXHRcdFx0YmFzaWMgPSAwO1xuXHRcdH1cblxuXHRcdGZvciAoaiA9IDA7IGogPCBiYXNpYzsgKytqKSB7XG5cdFx0XHQvLyBpZiBpdCdzIG5vdCBhIGJhc2ljIGNvZGUgcG9pbnRcblx0XHRcdGlmIChpbnB1dC5jaGFyQ29kZUF0KGopID49IDB4ODApIHtcblx0XHRcdFx0ZXJyb3IoJ25vdC1iYXNpYycpO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0LnB1c2goaW5wdXQuY2hhckNvZGVBdChqKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBkZWNvZGluZyBsb29wOiBzdGFydCBqdXN0IGFmdGVyIHRoZSBsYXN0IGRlbGltaXRlciBpZiBhbnkgYmFzaWMgY29kZVxuXHRcdC8vIHBvaW50cyB3ZXJlIGNvcGllZDsgc3RhcnQgYXQgdGhlIGJlZ2lubmluZyBvdGhlcndpc2UuXG5cblx0XHRmb3IgKGluZGV4ID0gYmFzaWMgPiAwID8gYmFzaWMgKyAxIDogMDsgaW5kZXggPCBpbnB1dExlbmd0aDsgLyogbm8gZmluYWwgZXhwcmVzc2lvbiAqLykge1xuXG5cdFx0XHQvLyBgaW5kZXhgIGlzIHRoZSBpbmRleCBvZiB0aGUgbmV4dCBjaGFyYWN0ZXIgdG8gYmUgY29uc3VtZWQuXG5cdFx0XHQvLyBEZWNvZGUgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlciBpbnRvIGBkZWx0YWAsXG5cdFx0XHQvLyB3aGljaCBnZXRzIGFkZGVkIHRvIGBpYC4gVGhlIG92ZXJmbG93IGNoZWNraW5nIGlzIGVhc2llclxuXHRcdFx0Ly8gaWYgd2UgaW5jcmVhc2UgYGlgIGFzIHdlIGdvLCB0aGVuIHN1YnRyYWN0IG9mZiBpdHMgc3RhcnRpbmdcblx0XHRcdC8vIHZhbHVlIGF0IHRoZSBlbmQgdG8gb2J0YWluIGBkZWx0YWAuXG5cdFx0XHRmb3IgKG9sZGkgPSBpLCB3ID0gMSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cblx0XHRcdFx0aWYgKGluZGV4ID49IGlucHV0TGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRpZ2l0ID0gYmFzaWNUb0RpZ2l0KGlucHV0LmNoYXJDb2RlQXQoaW5kZXgrKykpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA+PSBiYXNlIHx8IGRpZ2l0ID4gZmxvb3IoKG1heEludCAtIGkpIC8gdykpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGkgKz0gZGlnaXQgKiB3O1xuXHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPCB0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdGlmICh3ID4gZmxvb3IobWF4SW50IC8gYmFzZU1pbnVzVCkpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHcgKj0gYmFzZU1pbnVzVDtcblxuXHRcdFx0fVxuXG5cdFx0XHRvdXQgPSBvdXRwdXQubGVuZ3RoICsgMTtcblx0XHRcdGJpYXMgPSBhZGFwdChpIC0gb2xkaSwgb3V0LCBvbGRpID09IDApO1xuXG5cdFx0XHQvLyBgaWAgd2FzIHN1cHBvc2VkIHRvIHdyYXAgYXJvdW5kIGZyb20gYG91dGAgdG8gYDBgLFxuXHRcdFx0Ly8gaW5jcmVtZW50aW5nIGBuYCBlYWNoIHRpbWUsIHNvIHdlJ2xsIGZpeCB0aGF0IG5vdzpcblx0XHRcdGlmIChmbG9vcihpIC8gb3V0KSA+IG1heEludCAtIG4pIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdG4gKz0gZmxvb3IoaSAvIG91dCk7XG5cdFx0XHRpICU9IG91dDtcblxuXHRcdFx0Ly8gSW5zZXJ0IGBuYCBhdCBwb3NpdGlvbiBgaWAgb2YgdGhlIG91dHB1dFxuXHRcdFx0b3V0cHV0LnNwbGljZShpKyssIDAsIG4pO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVjczJlbmNvZGUob3V0cHV0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMgKGUuZy4gYSBkb21haW4gbmFtZSBsYWJlbCkgdG8gYVxuXHQgKiBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBlbmNvZGUoaW5wdXQpIHtcblx0XHR2YXIgbixcblx0XHQgICAgZGVsdGEsXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50LFxuXHRcdCAgICBiYXNpY0xlbmd0aCxcblx0XHQgICAgYmlhcyxcblx0XHQgICAgaixcblx0XHQgICAgbSxcblx0XHQgICAgcSxcblx0XHQgICAgayxcblx0XHQgICAgdCxcblx0XHQgICAgY3VycmVudFZhbHVlLFxuXHRcdCAgICBvdXRwdXQgPSBbXSxcblx0XHQgICAgLyoqIGBpbnB1dExlbmd0aGAgd2lsbCBob2xkIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgaW4gYGlucHV0YC4gKi9cblx0XHQgICAgaW5wdXRMZW5ndGgsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsXG5cdFx0ICAgIGJhc2VNaW51c1QsXG5cdFx0ICAgIHFNaW51c1Q7XG5cblx0XHQvLyBDb252ZXJ0IHRoZSBpbnB1dCBpbiBVQ1MtMiB0byBVbmljb2RlXG5cdFx0aW5wdXQgPSB1Y3MyZGVjb2RlKGlucHV0KTtcblxuXHRcdC8vIENhY2hlIHRoZSBsZW5ndGhcblx0XHRpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aDtcblxuXHRcdC8vIEluaXRpYWxpemUgdGhlIHN0YXRlXG5cdFx0biA9IGluaXRpYWxOO1xuXHRcdGRlbHRhID0gMDtcblx0XHRiaWFzID0gaW5pdGlhbEJpYXM7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzXG5cdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IDB4ODApIHtcblx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGN1cnJlbnRWYWx1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGhhbmRsZWRDUENvdW50ID0gYmFzaWNMZW5ndGggPSBvdXRwdXQubGVuZ3RoO1xuXG5cdFx0Ly8gYGhhbmRsZWRDUENvdW50YCBpcyB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIHRoYXQgaGF2ZSBiZWVuIGhhbmRsZWQ7XG5cdFx0Ly8gYGJhc2ljTGVuZ3RoYCBpcyB0aGUgbnVtYmVyIG9mIGJhc2ljIGNvZGUgcG9pbnRzLlxuXG5cdFx0Ly8gRmluaXNoIHRoZSBiYXNpYyBzdHJpbmcgLSBpZiBpdCBpcyBub3QgZW1wdHkgLSB3aXRoIGEgZGVsaW1pdGVyXG5cdFx0aWYgKGJhc2ljTGVuZ3RoKSB7XG5cdFx0XHRvdXRwdXQucHVzaChkZWxpbWl0ZXIpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZW5jb2RpbmcgbG9vcDpcblx0XHR3aGlsZSAoaGFuZGxlZENQQ291bnQgPCBpbnB1dExlbmd0aCkge1xuXG5cdFx0XHQvLyBBbGwgbm9uLWJhc2ljIGNvZGUgcG9pbnRzIDwgbiBoYXZlIGJlZW4gaGFuZGxlZCBhbHJlYWR5LiBGaW5kIHRoZSBuZXh0XG5cdFx0XHQvLyBsYXJnZXIgb25lOlxuXHRcdFx0Zm9yIChtID0gbWF4SW50LCBqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPj0gbiAmJiBjdXJyZW50VmFsdWUgPCBtKSB7XG5cdFx0XHRcdFx0bSA9IGN1cnJlbnRWYWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbmNyZWFzZSBgZGVsdGFgIGVub3VnaCB0byBhZHZhbmNlIHRoZSBkZWNvZGVyJ3MgPG4saT4gc3RhdGUgdG8gPG0sMD4sXG5cdFx0XHQvLyBidXQgZ3VhcmQgYWdhaW5zdCBvdmVyZmxvd1xuXHRcdFx0aGFuZGxlZENQQ291bnRQbHVzT25lID0gaGFuZGxlZENQQ291bnQgKyAxO1xuXHRcdFx0aWYgKG0gLSBuID4gZmxvb3IoKG1heEludCAtIGRlbHRhKSAvIGhhbmRsZWRDUENvdW50UGx1c09uZSkpIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGRlbHRhICs9IChtIC0gbikgKiBoYW5kbGVkQ1BDb3VudFBsdXNPbmU7XG5cdFx0XHRuID0gbTtcblxuXHRcdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IG4gJiYgKytkZWx0YSA+IG1heEludCkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA9PSBuKSB7XG5cdFx0XHRcdFx0Ly8gUmVwcmVzZW50IGRlbHRhIGFzIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXJcblx0XHRcdFx0XHRmb3IgKHEgPSBkZWx0YSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cdFx0XHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblx0XHRcdFx0XHRcdGlmIChxIDwgdCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHFNaW51c1QgPSBxIC0gdDtcblx0XHRcdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKFxuXHRcdFx0XHRcdFx0XHRzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHQgKyBxTWludXNUICUgYmFzZU1pbnVzVCwgMCkpXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0cSA9IGZsb29yKHFNaW51c1QgLyBiYXNlTWludXNUKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHEsIDApKSk7XG5cdFx0XHRcdFx0YmlhcyA9IGFkYXB0KGRlbHRhLCBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsIGhhbmRsZWRDUENvdW50ID09IGJhc2ljTGVuZ3RoKTtcblx0XHRcdFx0XHRkZWx0YSA9IDA7XG5cdFx0XHRcdFx0KytoYW5kbGVkQ1BDb3VudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQrK2RlbHRhO1xuXHRcdFx0KytuO1xuXG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgb3IgYW4gZW1haWwgYWRkcmVzc1xuXHQgKiB0byBVbmljb2RlLiBPbmx5IHRoZSBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGlucHV0IHdpbGwgYmUgY29udmVydGVkLCBpLmUuXG5cdCAqIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIHlvdSBjYWxsIGl0IG9uIGEgc3RyaW5nIHRoYXQgaGFzIGFscmVhZHkgYmVlblxuXHQgKiBjb252ZXJ0ZWQgdG8gVW5pY29kZS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGVkIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MgdG9cblx0ICogY29udmVydCB0byBVbmljb2RlLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgVW5pY29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gUHVueWNvZGVcblx0ICogc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9Vbmljb2RlKGlucHV0KSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihpbnB1dCwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyBkZWNvZGUoc3RyaW5nLnNsaWNlKDQpLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgb3IgYW4gZW1haWwgYWRkcmVzcyB0b1xuXHQgKiBQdW55Y29kZS4gT25seSB0aGUgbm9uLUFTQ0lJIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB3aWxsIGJlIGNvbnZlcnRlZCxcblx0ICogaS5lLiBpdCBkb2Vzbid0IG1hdHRlciBpZiB5b3UgY2FsbCBpdCB3aXRoIGEgZG9tYWluIHRoYXQncyBhbHJlYWR5IGluXG5cdCAqIEFTQ0lJLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzIHRvIGNvbnZlcnQsIGFzIGFcblx0ICogVW5pY29kZSBzdHJpbmcuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBQdW55Y29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gZG9tYWluIG5hbWUgb3Jcblx0ICogZW1haWwgYWRkcmVzcy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvQVNDSUkoaW5wdXQpIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGlucHV0LCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/ICd4bi0tJyArIGVuY29kZShzdHJpbmcpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqIERlZmluZSB0aGUgcHVibGljIEFQSSAqL1xuXHRwdW55Y29kZSA9IHtcblx0XHQvKipcblx0XHQgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgUHVueWNvZGUuanMgdmVyc2lvbiBudW1iZXIuXG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgU3RyaW5nXG5cdFx0ICovXG5cdFx0J3ZlcnNpb24nOiAnMS40LjEnLFxuXHRcdC8qKlxuXHRcdCAqIEFuIG9iamVjdCBvZiBtZXRob2RzIHRvIGNvbnZlcnQgZnJvbSBKYXZhU2NyaXB0J3MgaW50ZXJuYWwgY2hhcmFjdGVyXG5cdFx0ICogcmVwcmVzZW50YXRpb24gKFVDUy0yKSB0byBVbmljb2RlIGNvZGUgcG9pbnRzLCBhbmQgYmFjay5cblx0XHQgKiBAc2VlIDxodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBPYmplY3Rcblx0XHQgKi9cblx0XHQndWNzMic6IHtcblx0XHRcdCdkZWNvZGUnOiB1Y3MyZGVjb2RlLFxuXHRcdFx0J2VuY29kZSc6IHVjczJlbmNvZGVcblx0XHR9LFxuXHRcdCdkZWNvZGUnOiBkZWNvZGUsXG5cdFx0J2VuY29kZSc6IGVuY29kZSxcblx0XHQndG9BU0NJSSc6IHRvQVNDSUksXG5cdFx0J3RvVW5pY29kZSc6IHRvVW5pY29kZVxuXHR9O1xuXG5cdC8qKiBFeHBvc2UgYHB1bnljb2RlYCAqL1xuXHQvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBzcGVjaWZpYyBjb25kaXRpb24gcGF0dGVybnNcblx0Ly8gbGlrZSB0aGUgZm9sbG93aW5nOlxuXHRpZiAoXG5cdFx0dHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmXG5cdFx0dHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiZcblx0XHRkZWZpbmUuYW1kXG5cdCkge1xuXHRcdGRlZmluZSgncHVueWNvZGUnLCBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBwdW55Y29kZTtcblx0XHR9KTtcblx0fSBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XG5cdFx0aWYgKG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzKSB7XG5cdFx0XHQvLyBpbiBOb2RlLmpzLCBpby5qcywgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBwdW55Y29kZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cblx0XHRcdGZvciAoa2V5IGluIHB1bnljb2RlKSB7XG5cdFx0XHRcdHB1bnljb2RlLmhhc093blByb3BlcnR5KGtleSkgJiYgKGZyZWVFeHBvcnRzW2tleV0gPSBwdW55Y29kZVtrZXldKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Ly8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QucHVueWNvZGUgPSBwdW55Y29kZTtcblx0fVxuXG59KHRoaXMpKTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbi8vIElmIG9iai5oYXNPd25Qcm9wZXJ0eSBoYXMgYmVlbiBvdmVycmlkZGVuLCB0aGVuIGNhbGxpbmdcbi8vIG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSB3aWxsIGJyZWFrLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvaXNzdWVzLzE3MDdcbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocXMsIHNlcCwgZXEsIG9wdGlvbnMpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIHZhciBvYmogPSB7fTtcblxuICBpZiAodHlwZW9mIHFzICE9PSAnc3RyaW5nJyB8fCBxcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgdmFyIHJlZ2V4cCA9IC9cXCsvZztcbiAgcXMgPSBxcy5zcGxpdChzZXApO1xuXG4gIHZhciBtYXhLZXlzID0gMTAwMDtcbiAgaWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMubWF4S2V5cyA9PT0gJ251bWJlcicpIHtcbiAgICBtYXhLZXlzID0gb3B0aW9ucy5tYXhLZXlzO1xuICB9XG5cbiAgdmFyIGxlbiA9IHFzLmxlbmd0aDtcbiAgLy8gbWF4S2V5cyA8PSAwIG1lYW5zIHRoYXQgd2Ugc2hvdWxkIG5vdCBsaW1pdCBrZXlzIGNvdW50XG4gIGlmIChtYXhLZXlzID4gMCAmJiBsZW4gPiBtYXhLZXlzKSB7XG4gICAgbGVuID0gbWF4S2V5cztcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICB2YXIgeCA9IHFzW2ldLnJlcGxhY2UocmVnZXhwLCAnJTIwJyksXG4gICAgICAgIGlkeCA9IHguaW5kZXhPZihlcSksXG4gICAgICAgIGtzdHIsIHZzdHIsIGssIHY7XG5cbiAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgIGtzdHIgPSB4LnN1YnN0cigwLCBpZHgpO1xuICAgICAgdnN0ciA9IHguc3Vic3RyKGlkeCArIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBrc3RyID0geDtcbiAgICAgIHZzdHIgPSAnJztcbiAgICB9XG5cbiAgICBrID0gZGVjb2RlVVJJQ29tcG9uZW50KGtzdHIpO1xuICAgIHYgPSBkZWNvZGVVUklDb21wb25lbnQodnN0cik7XG5cbiAgICBpZiAoIWhhc093blByb3BlcnR5KG9iaiwgaykpIHtcbiAgICAgIG9ialtrXSA9IHY7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgIG9ialtrXS5wdXNoKHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmpba10gPSBbb2JqW2tdLCB2XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb2JqO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5naWZ5UHJpbWl0aXZlID0gZnVuY3Rpb24odikge1xuICBzd2l0Y2ggKHR5cGVvZiB2KSB7XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHJldHVybiB2O1xuXG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gdiA/ICd0cnVlJyA6ICdmYWxzZSc7XG5cbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIGlzRmluaXRlKHYpID8gdiA6ICcnO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiAnJztcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvYmosIHNlcCwgZXEsIG5hbWUpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIGlmIChvYmogPT09IG51bGwpIHtcbiAgICBvYmogPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gbWFwKG9iamVjdEtleXMob2JqKSwgZnVuY3Rpb24oaykge1xuICAgICAgdmFyIGtzID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShrKSkgKyBlcTtcbiAgICAgIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgICAgcmV0dXJuIG1hcChvYmpba10sIGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKHYpKTtcbiAgICAgICAgfSkuam9pbihzZXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmpba10pKTtcbiAgICAgIH1cbiAgICB9KS5qb2luKHNlcCk7XG5cbiAgfVxuXG4gIGlmICghbmFtZSkgcmV0dXJuICcnO1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShuYW1lKSkgKyBlcSArXG4gICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9iaikpO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbmZ1bmN0aW9uIG1hcCAoeHMsIGYpIHtcbiAgaWYgKHhzLm1hcCkgcmV0dXJuIHhzLm1hcChmKTtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzLnB1c2goZih4c1tpXSwgaSkpO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkgcmVzLnB1c2goa2V5KTtcbiAgfVxuICByZXR1cm4gcmVzO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5kZWNvZGUgPSBleHBvcnRzLnBhcnNlID0gcmVxdWlyZSgnLi9kZWNvZGUnKTtcbmV4cG9ydHMuZW5jb2RlID0gZXhwb3J0cy5zdHJpbmdpZnkgPSByZXF1aXJlKCcuL2VuY29kZScpO1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHB1bnljb2RlID0gcmVxdWlyZSgncHVueWNvZGUnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmV4cG9ydHMucGFyc2UgPSB1cmxQYXJzZTtcbmV4cG9ydHMucmVzb2x2ZSA9IHVybFJlc29sdmU7XG5leHBvcnRzLnJlc29sdmVPYmplY3QgPSB1cmxSZXNvbHZlT2JqZWN0O1xuZXhwb3J0cy5mb3JtYXQgPSB1cmxGb3JtYXQ7XG5cbmV4cG9ydHMuVXJsID0gVXJsO1xuXG5mdW5jdGlvbiBVcmwoKSB7XG4gIHRoaXMucHJvdG9jb2wgPSBudWxsO1xuICB0aGlzLnNsYXNoZXMgPSBudWxsO1xuICB0aGlzLmF1dGggPSBudWxsO1xuICB0aGlzLmhvc3QgPSBudWxsO1xuICB0aGlzLnBvcnQgPSBudWxsO1xuICB0aGlzLmhvc3RuYW1lID0gbnVsbDtcbiAgdGhpcy5oYXNoID0gbnVsbDtcbiAgdGhpcy5zZWFyY2ggPSBudWxsO1xuICB0aGlzLnF1ZXJ5ID0gbnVsbDtcbiAgdGhpcy5wYXRobmFtZSA9IG51bGw7XG4gIHRoaXMucGF0aCA9IG51bGw7XG4gIHRoaXMuaHJlZiA9IG51bGw7XG59XG5cbi8vIFJlZmVyZW5jZTogUkZDIDM5ODYsIFJGQyAxODA4LCBSRkMgMjM5NlxuXG4vLyBkZWZpbmUgdGhlc2UgaGVyZSBzbyBhdCBsZWFzdCB0aGV5IG9ubHkgaGF2ZSB0byBiZVxuLy8gY29tcGlsZWQgb25jZSBvbiB0aGUgZmlyc3QgbW9kdWxlIGxvYWQuXG52YXIgcHJvdG9jb2xQYXR0ZXJuID0gL14oW2EtejAtOS4rLV0rOikvaSxcbiAgICBwb3J0UGF0dGVybiA9IC86WzAtOV0qJC8sXG5cbiAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIGEgc2ltcGxlIHBhdGggVVJMXG4gICAgc2ltcGxlUGF0aFBhdHRlcm4gPSAvXihcXC9cXC8/KD8hXFwvKVteXFw/XFxzXSopKFxcP1teXFxzXSopPyQvLFxuXG4gICAgLy8gUkZDIDIzOTY6IGNoYXJhY3RlcnMgcmVzZXJ2ZWQgZm9yIGRlbGltaXRpbmcgVVJMcy5cbiAgICAvLyBXZSBhY3R1YWxseSBqdXN0IGF1dG8tZXNjYXBlIHRoZXNlLlxuICAgIGRlbGltcyA9IFsnPCcsICc+JywgJ1wiJywgJ2AnLCAnICcsICdcXHInLCAnXFxuJywgJ1xcdCddLFxuXG4gICAgLy8gUkZDIDIzOTY6IGNoYXJhY3RlcnMgbm90IGFsbG93ZWQgZm9yIHZhcmlvdXMgcmVhc29ucy5cbiAgICB1bndpc2UgPSBbJ3snLCAnfScsICd8JywgJ1xcXFwnLCAnXicsICdgJ10uY29uY2F0KGRlbGltcyksXG5cbiAgICAvLyBBbGxvd2VkIGJ5IFJGQ3MsIGJ1dCBjYXVzZSBvZiBYU1MgYXR0YWNrcy4gIEFsd2F5cyBlc2NhcGUgdGhlc2UuXG4gICAgYXV0b0VzY2FwZSA9IFsnXFwnJ10uY29uY2F0KHVud2lzZSksXG4gICAgLy8gQ2hhcmFjdGVycyB0aGF0IGFyZSBuZXZlciBldmVyIGFsbG93ZWQgaW4gYSBob3N0bmFtZS5cbiAgICAvLyBOb3RlIHRoYXQgYW55IGludmFsaWQgY2hhcnMgYXJlIGFsc28gaGFuZGxlZCwgYnV0IHRoZXNlXG4gICAgLy8gYXJlIHRoZSBvbmVzIHRoYXQgYXJlICpleHBlY3RlZCogdG8gYmUgc2Vlbiwgc28gd2UgZmFzdC1wYXRoXG4gICAgLy8gdGhlbS5cbiAgICBub25Ib3N0Q2hhcnMgPSBbJyUnLCAnLycsICc/JywgJzsnLCAnIyddLmNvbmNhdChhdXRvRXNjYXBlKSxcbiAgICBob3N0RW5kaW5nQ2hhcnMgPSBbJy8nLCAnPycsICcjJ10sXG4gICAgaG9zdG5hbWVNYXhMZW4gPSAyNTUsXG4gICAgaG9zdG5hbWVQYXJ0UGF0dGVybiA9IC9eWythLXowLTlBLVpfLV17MCw2M30kLyxcbiAgICBob3N0bmFtZVBhcnRTdGFydCA9IC9eKFsrYS16MC05QS1aXy1dezAsNjN9KSguKikkLyxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBjYW4gYWxsb3cgXCJ1bnNhZmVcIiBhbmQgXCJ1bndpc2VcIiBjaGFycy5cbiAgICB1bnNhZmVQcm90b2NvbCA9IHtcbiAgICAgICdqYXZhc2NyaXB0JzogdHJ1ZSxcbiAgICAgICdqYXZhc2NyaXB0Oic6IHRydWVcbiAgICB9LFxuICAgIC8vIHByb3RvY29scyB0aGF0IG5ldmVyIGhhdmUgYSBob3N0bmFtZS5cbiAgICBob3N0bGVzc1Byb3RvY29sID0ge1xuICAgICAgJ2phdmFzY3JpcHQnOiB0cnVlLFxuICAgICAgJ2phdmFzY3JpcHQ6JzogdHJ1ZVxuICAgIH0sXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgYWx3YXlzIGNvbnRhaW4gYSAvLyBiaXQuXG4gICAgc2xhc2hlZFByb3RvY29sID0ge1xuICAgICAgJ2h0dHAnOiB0cnVlLFxuICAgICAgJ2h0dHBzJzogdHJ1ZSxcbiAgICAgICdmdHAnOiB0cnVlLFxuICAgICAgJ2dvcGhlcic6IHRydWUsXG4gICAgICAnZmlsZSc6IHRydWUsXG4gICAgICAnaHR0cDonOiB0cnVlLFxuICAgICAgJ2h0dHBzOic6IHRydWUsXG4gICAgICAnZnRwOic6IHRydWUsXG4gICAgICAnZ29waGVyOic6IHRydWUsXG4gICAgICAnZmlsZTonOiB0cnVlXG4gICAgfSxcbiAgICBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbmZ1bmN0aW9uIHVybFBhcnNlKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpIHtcbiAgaWYgKHVybCAmJiB1dGlsLmlzT2JqZWN0KHVybCkgJiYgdXJsIGluc3RhbmNlb2YgVXJsKSByZXR1cm4gdXJsO1xuXG4gIHZhciB1ID0gbmV3IFVybDtcbiAgdS5wYXJzZSh1cmwsIHBhcnNlUXVlcnlTdHJpbmcsIHNsYXNoZXNEZW5vdGVIb3N0KTtcbiAgcmV0dXJuIHU7XG59XG5cblVybC5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbih1cmwsIHBhcnNlUXVlcnlTdHJpbmcsIHNsYXNoZXNEZW5vdGVIb3N0KSB7XG4gIGlmICghdXRpbC5pc1N0cmluZyh1cmwpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlBhcmFtZXRlciAndXJsJyBtdXN0IGJlIGEgc3RyaW5nLCBub3QgXCIgKyB0eXBlb2YgdXJsKTtcbiAgfVxuXG4gIC8vIENvcHkgY2hyb21lLCBJRSwgb3BlcmEgYmFja3NsYXNoLWhhbmRsaW5nIGJlaGF2aW9yLlxuICAvLyBCYWNrIHNsYXNoZXMgYmVmb3JlIHRoZSBxdWVyeSBzdHJpbmcgZ2V0IGNvbnZlcnRlZCB0byBmb3J3YXJkIHNsYXNoZXNcbiAgLy8gU2VlOiBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MjU5MTZcbiAgdmFyIHF1ZXJ5SW5kZXggPSB1cmwuaW5kZXhPZignPycpLFxuICAgICAgc3BsaXR0ZXIgPVxuICAgICAgICAgIChxdWVyeUluZGV4ICE9PSAtMSAmJiBxdWVyeUluZGV4IDwgdXJsLmluZGV4T2YoJyMnKSkgPyAnPycgOiAnIycsXG4gICAgICB1U3BsaXQgPSB1cmwuc3BsaXQoc3BsaXR0ZXIpLFxuICAgICAgc2xhc2hSZWdleCA9IC9cXFxcL2c7XG4gIHVTcGxpdFswXSA9IHVTcGxpdFswXS5yZXBsYWNlKHNsYXNoUmVnZXgsICcvJyk7XG4gIHVybCA9IHVTcGxpdC5qb2luKHNwbGl0dGVyKTtcblxuICB2YXIgcmVzdCA9IHVybDtcblxuICAvLyB0cmltIGJlZm9yZSBwcm9jZWVkaW5nLlxuICAvLyBUaGlzIGlzIHRvIHN1cHBvcnQgcGFyc2Ugc3R1ZmYgbGlrZSBcIiAgaHR0cDovL2Zvby5jb20gIFxcblwiXG4gIHJlc3QgPSByZXN0LnRyaW0oKTtcblxuICBpZiAoIXNsYXNoZXNEZW5vdGVIb3N0ICYmIHVybC5zcGxpdCgnIycpLmxlbmd0aCA9PT0gMSkge1xuICAgIC8vIFRyeSBmYXN0IHBhdGggcmVnZXhwXG4gICAgdmFyIHNpbXBsZVBhdGggPSBzaW1wbGVQYXRoUGF0dGVybi5leGVjKHJlc3QpO1xuICAgIGlmIChzaW1wbGVQYXRoKSB7XG4gICAgICB0aGlzLnBhdGggPSByZXN0O1xuICAgICAgdGhpcy5ocmVmID0gcmVzdDtcbiAgICAgIHRoaXMucGF0aG5hbWUgPSBzaW1wbGVQYXRoWzFdO1xuICAgICAgaWYgKHNpbXBsZVBhdGhbMl0pIHtcbiAgICAgICAgdGhpcy5zZWFyY2ggPSBzaW1wbGVQYXRoWzJdO1xuICAgICAgICBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgICAgIHRoaXMucXVlcnkgPSBxdWVyeXN0cmluZy5wYXJzZSh0aGlzLnNlYXJjaC5zdWJzdHIoMSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucXVlcnkgPSB0aGlzLnNlYXJjaC5zdWJzdHIoMSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgICB0aGlzLnNlYXJjaCA9ICcnO1xuICAgICAgICB0aGlzLnF1ZXJ5ID0ge307XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gIH1cblxuICB2YXIgcHJvdG8gPSBwcm90b2NvbFBhdHRlcm4uZXhlYyhyZXN0KTtcbiAgaWYgKHByb3RvKSB7XG4gICAgcHJvdG8gPSBwcm90b1swXTtcbiAgICB2YXIgbG93ZXJQcm90byA9IHByb3RvLnRvTG93ZXJDYXNlKCk7XG4gICAgdGhpcy5wcm90b2NvbCA9IGxvd2VyUHJvdG87XG4gICAgcmVzdCA9IHJlc3Quc3Vic3RyKHByb3RvLmxlbmd0aCk7XG4gIH1cblxuICAvLyBmaWd1cmUgb3V0IGlmIGl0J3MgZ290IGEgaG9zdFxuICAvLyB1c2VyQHNlcnZlciBpcyAqYWx3YXlzKiBpbnRlcnByZXRlZCBhcyBhIGhvc3RuYW1lLCBhbmQgdXJsXG4gIC8vIHJlc29sdXRpb24gd2lsbCB0cmVhdCAvL2Zvby9iYXIgYXMgaG9zdD1mb28scGF0aD1iYXIgYmVjYXVzZSB0aGF0J3NcbiAgLy8gaG93IHRoZSBicm93c2VyIHJlc29sdmVzIHJlbGF0aXZlIFVSTHMuXG4gIGlmIChzbGFzaGVzRGVub3RlSG9zdCB8fCBwcm90byB8fCByZXN0Lm1hdGNoKC9eXFwvXFwvW15AXFwvXStAW15AXFwvXSsvKSkge1xuICAgIHZhciBzbGFzaGVzID0gcmVzdC5zdWJzdHIoMCwgMikgPT09ICcvLyc7XG4gICAgaWYgKHNsYXNoZXMgJiYgIShwcm90byAmJiBob3N0bGVzc1Byb3RvY29sW3Byb3RvXSkpIHtcbiAgICAgIHJlc3QgPSByZXN0LnN1YnN0cigyKTtcbiAgICAgIHRoaXMuc2xhc2hlcyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFob3N0bGVzc1Byb3RvY29sW3Byb3RvXSAmJlxuICAgICAgKHNsYXNoZXMgfHwgKHByb3RvICYmICFzbGFzaGVkUHJvdG9jb2xbcHJvdG9dKSkpIHtcblxuICAgIC8vIHRoZXJlJ3MgYSBob3N0bmFtZS5cbiAgICAvLyB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgLywgPywgOywgb3IgIyBlbmRzIHRoZSBob3N0LlxuICAgIC8vXG4gICAgLy8gSWYgdGhlcmUgaXMgYW4gQCBpbiB0aGUgaG9zdG5hbWUsIHRoZW4gbm9uLWhvc3QgY2hhcnMgKmFyZSogYWxsb3dlZFxuICAgIC8vIHRvIHRoZSBsZWZ0IG9mIHRoZSBsYXN0IEAgc2lnbiwgdW5sZXNzIHNvbWUgaG9zdC1lbmRpbmcgY2hhcmFjdGVyXG4gICAgLy8gY29tZXMgKmJlZm9yZSogdGhlIEAtc2lnbi5cbiAgICAvLyBVUkxzIGFyZSBvYm5veGlvdXMuXG4gICAgLy9cbiAgICAvLyBleDpcbiAgICAvLyBodHRwOi8vYUBiQGMvID0+IHVzZXI6YUBiIGhvc3Q6Y1xuICAgIC8vIGh0dHA6Ly9hQGI/QGMgPT4gdXNlcjphIGhvc3Q6YyBwYXRoOi8/QGNcblxuICAgIC8vIHYwLjEyIFRPRE8oaXNhYWNzKTogVGhpcyBpcyBub3QgcXVpdGUgaG93IENocm9tZSBkb2VzIHRoaW5ncy5cbiAgICAvLyBSZXZpZXcgb3VyIHRlc3QgY2FzZSBhZ2FpbnN0IGJyb3dzZXJzIG1vcmUgY29tcHJlaGVuc2l2ZWx5LlxuXG4gICAgLy8gZmluZCB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgYW55IGhvc3RFbmRpbmdDaGFyc1xuICAgIHZhciBob3N0RW5kID0gLTE7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBob3N0RW5kaW5nQ2hhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBoZWMgPSByZXN0LmluZGV4T2YoaG9zdEVuZGluZ0NoYXJzW2ldKTtcbiAgICAgIGlmIChoZWMgIT09IC0xICYmIChob3N0RW5kID09PSAtMSB8fCBoZWMgPCBob3N0RW5kKSlcbiAgICAgICAgaG9zdEVuZCA9IGhlYztcbiAgICB9XG5cbiAgICAvLyBhdCB0aGlzIHBvaW50LCBlaXRoZXIgd2UgaGF2ZSBhbiBleHBsaWNpdCBwb2ludCB3aGVyZSB0aGVcbiAgICAvLyBhdXRoIHBvcnRpb24gY2Fubm90IGdvIHBhc3QsIG9yIHRoZSBsYXN0IEAgY2hhciBpcyB0aGUgZGVjaWRlci5cbiAgICB2YXIgYXV0aCwgYXRTaWduO1xuICAgIGlmIChob3N0RW5kID09PSAtMSkge1xuICAgICAgLy8gYXRTaWduIGNhbiBiZSBhbnl3aGVyZS5cbiAgICAgIGF0U2lnbiA9IHJlc3QubGFzdEluZGV4T2YoJ0AnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYXRTaWduIG11c3QgYmUgaW4gYXV0aCBwb3J0aW9uLlxuICAgICAgLy8gaHR0cDovL2FAYi9jQGQgPT4gaG9zdDpiIGF1dGg6YSBwYXRoOi9jQGRcbiAgICAgIGF0U2lnbiA9IHJlc3QubGFzdEluZGV4T2YoJ0AnLCBob3N0RW5kKTtcbiAgICB9XG5cbiAgICAvLyBOb3cgd2UgaGF2ZSBhIHBvcnRpb24gd2hpY2ggaXMgZGVmaW5pdGVseSB0aGUgYXV0aC5cbiAgICAvLyBQdWxsIHRoYXQgb2ZmLlxuICAgIGlmIChhdFNpZ24gIT09IC0xKSB7XG4gICAgICBhdXRoID0gcmVzdC5zbGljZSgwLCBhdFNpZ24pO1xuICAgICAgcmVzdCA9IHJlc3Quc2xpY2UoYXRTaWduICsgMSk7XG4gICAgICB0aGlzLmF1dGggPSBkZWNvZGVVUklDb21wb25lbnQoYXV0aCk7XG4gICAgfVxuXG4gICAgLy8gdGhlIGhvc3QgaXMgdGhlIHJlbWFpbmluZyB0byB0aGUgbGVmdCBvZiB0aGUgZmlyc3Qgbm9uLWhvc3QgY2hhclxuICAgIGhvc3RFbmQgPSAtMTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vbkhvc3RDaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGhlYyA9IHJlc3QuaW5kZXhPZihub25Ib3N0Q2hhcnNbaV0pO1xuICAgICAgaWYgKGhlYyAhPT0gLTEgJiYgKGhvc3RFbmQgPT09IC0xIHx8IGhlYyA8IGhvc3RFbmQpKVxuICAgICAgICBob3N0RW5kID0gaGVjO1xuICAgIH1cbiAgICAvLyBpZiB3ZSBzdGlsbCBoYXZlIG5vdCBoaXQgaXQsIHRoZW4gdGhlIGVudGlyZSB0aGluZyBpcyBhIGhvc3QuXG4gICAgaWYgKGhvc3RFbmQgPT09IC0xKVxuICAgICAgaG9zdEVuZCA9IHJlc3QubGVuZ3RoO1xuXG4gICAgdGhpcy5ob3N0ID0gcmVzdC5zbGljZSgwLCBob3N0RW5kKTtcbiAgICByZXN0ID0gcmVzdC5zbGljZShob3N0RW5kKTtcblxuICAgIC8vIHB1bGwgb3V0IHBvcnQuXG4gICAgdGhpcy5wYXJzZUhvc3QoKTtcblxuICAgIC8vIHdlJ3ZlIGluZGljYXRlZCB0aGF0IHRoZXJlIGlzIGEgaG9zdG5hbWUsXG4gICAgLy8gc28gZXZlbiBpZiBpdCdzIGVtcHR5LCBpdCBoYXMgdG8gYmUgcHJlc2VudC5cbiAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZSB8fCAnJztcblxuICAgIC8vIGlmIGhvc3RuYW1lIGJlZ2lucyB3aXRoIFsgYW5kIGVuZHMgd2l0aCBdXG4gICAgLy8gYXNzdW1lIHRoYXQgaXQncyBhbiBJUHY2IGFkZHJlc3MuXG4gICAgdmFyIGlwdjZIb3N0bmFtZSA9IHRoaXMuaG9zdG5hbWVbMF0gPT09ICdbJyAmJlxuICAgICAgICB0aGlzLmhvc3RuYW1lW3RoaXMuaG9zdG5hbWUubGVuZ3RoIC0gMV0gPT09ICddJztcblxuICAgIC8vIHZhbGlkYXRlIGEgbGl0dGxlLlxuICAgIGlmICghaXB2Nkhvc3RuYW1lKSB7XG4gICAgICB2YXIgaG9zdHBhcnRzID0gdGhpcy5ob3N0bmFtZS5zcGxpdCgvXFwuLyk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGhvc3RwYXJ0cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIHBhcnQgPSBob3N0cGFydHNbaV07XG4gICAgICAgIGlmICghcGFydCkgY29udGludWU7XG4gICAgICAgIGlmICghcGFydC5tYXRjaChob3N0bmFtZVBhcnRQYXR0ZXJuKSkge1xuICAgICAgICAgIHZhciBuZXdwYXJ0ID0gJyc7XG4gICAgICAgICAgZm9yICh2YXIgaiA9IDAsIGsgPSBwYXJ0Lmxlbmd0aDsgaiA8IGs7IGorKykge1xuICAgICAgICAgICAgaWYgKHBhcnQuY2hhckNvZGVBdChqKSA+IDEyNykge1xuICAgICAgICAgICAgICAvLyB3ZSByZXBsYWNlIG5vbi1BU0NJSSBjaGFyIHdpdGggYSB0ZW1wb3JhcnkgcGxhY2Vob2xkZXJcbiAgICAgICAgICAgICAgLy8gd2UgbmVlZCB0aGlzIHRvIG1ha2Ugc3VyZSBzaXplIG9mIGhvc3RuYW1lIGlzIG5vdFxuICAgICAgICAgICAgICAvLyBicm9rZW4gYnkgcmVwbGFjaW5nIG5vbi1BU0NJSSBieSBub3RoaW5nXG4gICAgICAgICAgICAgIG5ld3BhcnQgKz0gJ3gnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbmV3cGFydCArPSBwYXJ0W2pdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyB3ZSB0ZXN0IGFnYWluIHdpdGggQVNDSUkgY2hhciBvbmx5XG4gICAgICAgICAgaWYgKCFuZXdwYXJ0Lm1hdGNoKGhvc3RuYW1lUGFydFBhdHRlcm4pKSB7XG4gICAgICAgICAgICB2YXIgdmFsaWRQYXJ0cyA9IGhvc3RwYXJ0cy5zbGljZSgwLCBpKTtcbiAgICAgICAgICAgIHZhciBub3RIb3N0ID0gaG9zdHBhcnRzLnNsaWNlKGkgKyAxKTtcbiAgICAgICAgICAgIHZhciBiaXQgPSBwYXJ0Lm1hdGNoKGhvc3RuYW1lUGFydFN0YXJ0KTtcbiAgICAgICAgICAgIGlmIChiaXQpIHtcbiAgICAgICAgICAgICAgdmFsaWRQYXJ0cy5wdXNoKGJpdFsxXSk7XG4gICAgICAgICAgICAgIG5vdEhvc3QudW5zaGlmdChiaXRbMl0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5vdEhvc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIHJlc3QgPSAnLycgKyBub3RIb3N0LmpvaW4oJy4nKSArIHJlc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmhvc3RuYW1lID0gdmFsaWRQYXJ0cy5qb2luKCcuJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5ob3N0bmFtZS5sZW5ndGggPiBob3N0bmFtZU1heExlbikge1xuICAgICAgdGhpcy5ob3N0bmFtZSA9ICcnO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBob3N0bmFtZXMgYXJlIGFsd2F5cyBsb3dlciBjYXNlLlxuICAgICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICBpZiAoIWlwdjZIb3N0bmFtZSkge1xuICAgICAgLy8gSUROQSBTdXBwb3J0OiBSZXR1cm5zIGEgcHVueWNvZGVkIHJlcHJlc2VudGF0aW9uIG9mIFwiZG9tYWluXCIuXG4gICAgICAvLyBJdCBvbmx5IGNvbnZlcnRzIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB0aGF0XG4gICAgICAvLyBoYXZlIG5vbi1BU0NJSSBjaGFyYWN0ZXJzLCBpLmUuIGl0IGRvZXNuJ3QgbWF0dGVyIGlmXG4gICAgICAvLyB5b3UgY2FsbCBpdCB3aXRoIGEgZG9tYWluIHRoYXQgYWxyZWFkeSBpcyBBU0NJSS1vbmx5LlxuICAgICAgdGhpcy5ob3N0bmFtZSA9IHB1bnljb2RlLnRvQVNDSUkodGhpcy5ob3N0bmFtZSk7XG4gICAgfVxuXG4gICAgdmFyIHAgPSB0aGlzLnBvcnQgPyAnOicgKyB0aGlzLnBvcnQgOiAnJztcbiAgICB2YXIgaCA9IHRoaXMuaG9zdG5hbWUgfHwgJyc7XG4gICAgdGhpcy5ob3N0ID0gaCArIHA7XG4gICAgdGhpcy5ocmVmICs9IHRoaXMuaG9zdDtcblxuICAgIC8vIHN0cmlwIFsgYW5kIF0gZnJvbSB0aGUgaG9zdG5hbWVcbiAgICAvLyB0aGUgaG9zdCBmaWVsZCBzdGlsbCByZXRhaW5zIHRoZW0sIHRob3VnaFxuICAgIGlmIChpcHY2SG9zdG5hbWUpIHtcbiAgICAgIHRoaXMuaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lLnN1YnN0cigxLCB0aGlzLmhvc3RuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgaWYgKHJlc3RbMF0gIT09ICcvJykge1xuICAgICAgICByZXN0ID0gJy8nICsgcmVzdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBub3cgcmVzdCBpcyBzZXQgdG8gdGhlIHBvc3QtaG9zdCBzdHVmZi5cbiAgLy8gY2hvcCBvZmYgYW55IGRlbGltIGNoYXJzLlxuICBpZiAoIXVuc2FmZVByb3RvY29sW2xvd2VyUHJvdG9dKSB7XG5cbiAgICAvLyBGaXJzdCwgbWFrZSAxMDAlIHN1cmUgdGhhdCBhbnkgXCJhdXRvRXNjYXBlXCIgY2hhcnMgZ2V0XG4gICAgLy8gZXNjYXBlZCwgZXZlbiBpZiBlbmNvZGVVUklDb21wb25lbnQgZG9lc24ndCB0aGluayB0aGV5XG4gICAgLy8gbmVlZCB0byBiZS5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGF1dG9Fc2NhcGUubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB2YXIgYWUgPSBhdXRvRXNjYXBlW2ldO1xuICAgICAgaWYgKHJlc3QuaW5kZXhPZihhZSkgPT09IC0xKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIHZhciBlc2MgPSBlbmNvZGVVUklDb21wb25lbnQoYWUpO1xuICAgICAgaWYgKGVzYyA9PT0gYWUpIHtcbiAgICAgICAgZXNjID0gZXNjYXBlKGFlKTtcbiAgICAgIH1cbiAgICAgIHJlc3QgPSByZXN0LnNwbGl0KGFlKS5qb2luKGVzYyk7XG4gICAgfVxuICB9XG5cblxuICAvLyBjaG9wIG9mZiBmcm9tIHRoZSB0YWlsIGZpcnN0LlxuICB2YXIgaGFzaCA9IHJlc3QuaW5kZXhPZignIycpO1xuICBpZiAoaGFzaCAhPT0gLTEpIHtcbiAgICAvLyBnb3QgYSBmcmFnbWVudCBzdHJpbmcuXG4gICAgdGhpcy5oYXNoID0gcmVzdC5zdWJzdHIoaGFzaCk7XG4gICAgcmVzdCA9IHJlc3Quc2xpY2UoMCwgaGFzaCk7XG4gIH1cbiAgdmFyIHFtID0gcmVzdC5pbmRleE9mKCc/Jyk7XG4gIGlmIChxbSAhPT0gLTEpIHtcbiAgICB0aGlzLnNlYXJjaCA9IHJlc3Quc3Vic3RyKHFtKTtcbiAgICB0aGlzLnF1ZXJ5ID0gcmVzdC5zdWJzdHIocW0gKyAxKTtcbiAgICBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgICAgdGhpcy5xdWVyeSA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHRoaXMucXVlcnkpO1xuICAgIH1cbiAgICByZXN0ID0gcmVzdC5zbGljZSgwLCBxbSk7XG4gIH0gZWxzZSBpZiAocGFyc2VRdWVyeVN0cmluZykge1xuICAgIC8vIG5vIHF1ZXJ5IHN0cmluZywgYnV0IHBhcnNlUXVlcnlTdHJpbmcgc3RpbGwgcmVxdWVzdGVkXG4gICAgdGhpcy5zZWFyY2ggPSAnJztcbiAgICB0aGlzLnF1ZXJ5ID0ge307XG4gIH1cbiAgaWYgKHJlc3QpIHRoaXMucGF0aG5hbWUgPSByZXN0O1xuICBpZiAoc2xhc2hlZFByb3RvY29sW2xvd2VyUHJvdG9dICYmXG4gICAgICB0aGlzLmhvc3RuYW1lICYmICF0aGlzLnBhdGhuYW1lKSB7XG4gICAgdGhpcy5wYXRobmFtZSA9ICcvJztcbiAgfVxuXG4gIC8vdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgaWYgKHRoaXMucGF0aG5hbWUgfHwgdGhpcy5zZWFyY2gpIHtcbiAgICB2YXIgcCA9IHRoaXMucGF0aG5hbWUgfHwgJyc7XG4gICAgdmFyIHMgPSB0aGlzLnNlYXJjaCB8fCAnJztcbiAgICB0aGlzLnBhdGggPSBwICsgcztcbiAgfVxuXG4gIC8vIGZpbmFsbHksIHJlY29uc3RydWN0IHRoZSBocmVmIGJhc2VkIG9uIHdoYXQgaGFzIGJlZW4gdmFsaWRhdGVkLlxuICB0aGlzLmhyZWYgPSB0aGlzLmZvcm1hdCgpO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGZvcm1hdCBhIHBhcnNlZCBvYmplY3QgaW50byBhIHVybCBzdHJpbmdcbmZ1bmN0aW9uIHVybEZvcm1hdChvYmopIHtcbiAgLy8gZW5zdXJlIGl0J3MgYW4gb2JqZWN0LCBhbmQgbm90IGEgc3RyaW5nIHVybC5cbiAgLy8gSWYgaXQncyBhbiBvYmosIHRoaXMgaXMgYSBuby1vcC5cbiAgLy8gdGhpcyB3YXksIHlvdSBjYW4gY2FsbCB1cmxfZm9ybWF0KCkgb24gc3RyaW5nc1xuICAvLyB0byBjbGVhbiB1cCBwb3RlbnRpYWxseSB3b25reSB1cmxzLlxuICBpZiAodXRpbC5pc1N0cmluZyhvYmopKSBvYmogPSB1cmxQYXJzZShvYmopO1xuICBpZiAoIShvYmogaW5zdGFuY2VvZiBVcmwpKSByZXR1cm4gVXJsLnByb3RvdHlwZS5mb3JtYXQuY2FsbChvYmopO1xuICByZXR1cm4gb2JqLmZvcm1hdCgpO1xufVxuXG5VcmwucHJvdG90eXBlLmZvcm1hdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgYXV0aCA9IHRoaXMuYXV0aCB8fCAnJztcbiAgaWYgKGF1dGgpIHtcbiAgICBhdXRoID0gZW5jb2RlVVJJQ29tcG9uZW50KGF1dGgpO1xuICAgIGF1dGggPSBhdXRoLnJlcGxhY2UoLyUzQS9pLCAnOicpO1xuICAgIGF1dGggKz0gJ0AnO1xuICB9XG5cbiAgdmFyIHByb3RvY29sID0gdGhpcy5wcm90b2NvbCB8fCAnJyxcbiAgICAgIHBhdGhuYW1lID0gdGhpcy5wYXRobmFtZSB8fCAnJyxcbiAgICAgIGhhc2ggPSB0aGlzLmhhc2ggfHwgJycsXG4gICAgICBob3N0ID0gZmFsc2UsXG4gICAgICBxdWVyeSA9ICcnO1xuXG4gIGlmICh0aGlzLmhvc3QpIHtcbiAgICBob3N0ID0gYXV0aCArIHRoaXMuaG9zdDtcbiAgfSBlbHNlIGlmICh0aGlzLmhvc3RuYW1lKSB7XG4gICAgaG9zdCA9IGF1dGggKyAodGhpcy5ob3N0bmFtZS5pbmRleE9mKCc6JykgPT09IC0xID9cbiAgICAgICAgdGhpcy5ob3N0bmFtZSA6XG4gICAgICAgICdbJyArIHRoaXMuaG9zdG5hbWUgKyAnXScpO1xuICAgIGlmICh0aGlzLnBvcnQpIHtcbiAgICAgIGhvc3QgKz0gJzonICsgdGhpcy5wb3J0O1xuICAgIH1cbiAgfVxuXG4gIGlmICh0aGlzLnF1ZXJ5ICYmXG4gICAgICB1dGlsLmlzT2JqZWN0KHRoaXMucXVlcnkpICYmXG4gICAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJ5KS5sZW5ndGgpIHtcbiAgICBxdWVyeSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeSh0aGlzLnF1ZXJ5KTtcbiAgfVxuXG4gIHZhciBzZWFyY2ggPSB0aGlzLnNlYXJjaCB8fCAocXVlcnkgJiYgKCc/JyArIHF1ZXJ5KSkgfHwgJyc7XG5cbiAgaWYgKHByb3RvY29sICYmIHByb3RvY29sLnN1YnN0cigtMSkgIT09ICc6JykgcHJvdG9jb2wgKz0gJzonO1xuXG4gIC8vIG9ubHkgdGhlIHNsYXNoZWRQcm90b2NvbHMgZ2V0IHRoZSAvLy4gIE5vdCBtYWlsdG86LCB4bXBwOiwgZXRjLlxuICAvLyB1bmxlc3MgdGhleSBoYWQgdGhlbSB0byBiZWdpbiB3aXRoLlxuICBpZiAodGhpcy5zbGFzaGVzIHx8XG4gICAgICAoIXByb3RvY29sIHx8IHNsYXNoZWRQcm90b2NvbFtwcm90b2NvbF0pICYmIGhvc3QgIT09IGZhbHNlKSB7XG4gICAgaG9zdCA9ICcvLycgKyAoaG9zdCB8fCAnJyk7XG4gICAgaWYgKHBhdGhuYW1lICYmIHBhdGhuYW1lLmNoYXJBdCgwKSAhPT0gJy8nKSBwYXRobmFtZSA9ICcvJyArIHBhdGhuYW1lO1xuICB9IGVsc2UgaWYgKCFob3N0KSB7XG4gICAgaG9zdCA9ICcnO1xuICB9XG5cbiAgaWYgKGhhc2ggJiYgaGFzaC5jaGFyQXQoMCkgIT09ICcjJykgaGFzaCA9ICcjJyArIGhhc2g7XG4gIGlmIChzZWFyY2ggJiYgc2VhcmNoLmNoYXJBdCgwKSAhPT0gJz8nKSBzZWFyY2ggPSAnPycgKyBzZWFyY2g7XG5cbiAgcGF0aG5hbWUgPSBwYXRobmFtZS5yZXBsYWNlKC9bPyNdL2csIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChtYXRjaCk7XG4gIH0pO1xuICBzZWFyY2ggPSBzZWFyY2gucmVwbGFjZSgnIycsICclMjMnKTtcblxuICByZXR1cm4gcHJvdG9jb2wgKyBob3N0ICsgcGF0aG5hbWUgKyBzZWFyY2ggKyBoYXNoO1xufTtcblxuZnVuY3Rpb24gdXJsUmVzb2x2ZShzb3VyY2UsIHJlbGF0aXZlKSB7XG4gIHJldHVybiB1cmxQYXJzZShzb3VyY2UsIGZhbHNlLCB0cnVlKS5yZXNvbHZlKHJlbGF0aXZlKTtcbn1cblxuVXJsLnByb3RvdHlwZS5yZXNvbHZlID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcbiAgcmV0dXJuIHRoaXMucmVzb2x2ZU9iamVjdCh1cmxQYXJzZShyZWxhdGl2ZSwgZmFsc2UsIHRydWUpKS5mb3JtYXQoKTtcbn07XG5cbmZ1bmN0aW9uIHVybFJlc29sdmVPYmplY3Qoc291cmNlLCByZWxhdGl2ZSkge1xuICBpZiAoIXNvdXJjZSkgcmV0dXJuIHJlbGF0aXZlO1xuICByZXR1cm4gdXJsUGFyc2Uoc291cmNlLCBmYWxzZSwgdHJ1ZSkucmVzb2x2ZU9iamVjdChyZWxhdGl2ZSk7XG59XG5cblVybC5wcm90b3R5cGUucmVzb2x2ZU9iamVjdCA9IGZ1bmN0aW9uKHJlbGF0aXZlKSB7XG4gIGlmICh1dGlsLmlzU3RyaW5nKHJlbGF0aXZlKSkge1xuICAgIHZhciByZWwgPSBuZXcgVXJsKCk7XG4gICAgcmVsLnBhcnNlKHJlbGF0aXZlLCBmYWxzZSwgdHJ1ZSk7XG4gICAgcmVsYXRpdmUgPSByZWw7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0gbmV3IFVybCgpO1xuICB2YXIgdGtleXMgPSBPYmplY3Qua2V5cyh0aGlzKTtcbiAgZm9yICh2YXIgdGsgPSAwOyB0ayA8IHRrZXlzLmxlbmd0aDsgdGsrKykge1xuICAgIHZhciB0a2V5ID0gdGtleXNbdGtdO1xuICAgIHJlc3VsdFt0a2V5XSA9IHRoaXNbdGtleV07XG4gIH1cblxuICAvLyBoYXNoIGlzIGFsd2F5cyBvdmVycmlkZGVuLCBubyBtYXR0ZXIgd2hhdC5cbiAgLy8gZXZlbiBocmVmPVwiXCIgd2lsbCByZW1vdmUgaXQuXG4gIHJlc3VsdC5oYXNoID0gcmVsYXRpdmUuaGFzaDtcblxuICAvLyBpZiB0aGUgcmVsYXRpdmUgdXJsIGlzIGVtcHR5LCB0aGVuIHRoZXJlJ3Mgbm90aGluZyBsZWZ0IHRvIGRvIGhlcmUuXG4gIGlmIChyZWxhdGl2ZS5ocmVmID09PSAnJykge1xuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBocmVmcyBsaWtlIC8vZm9vL2JhciBhbHdheXMgY3V0IHRvIHRoZSBwcm90b2NvbC5cbiAgaWYgKHJlbGF0aXZlLnNsYXNoZXMgJiYgIXJlbGF0aXZlLnByb3RvY29sKSB7XG4gICAgLy8gdGFrZSBldmVyeXRoaW5nIGV4Y2VwdCB0aGUgcHJvdG9jb2wgZnJvbSByZWxhdGl2ZVxuICAgIHZhciBya2V5cyA9IE9iamVjdC5rZXlzKHJlbGF0aXZlKTtcbiAgICBmb3IgKHZhciByayA9IDA7IHJrIDwgcmtleXMubGVuZ3RoOyByaysrKSB7XG4gICAgICB2YXIgcmtleSA9IHJrZXlzW3JrXTtcbiAgICAgIGlmIChya2V5ICE9PSAncHJvdG9jb2wnKVxuICAgICAgICByZXN1bHRbcmtleV0gPSByZWxhdGl2ZVtya2V5XTtcbiAgICB9XG5cbiAgICAvL3VybFBhcnNlIGFwcGVuZHMgdHJhaWxpbmcgLyB0byB1cmxzIGxpa2UgaHR0cDovL3d3dy5leGFtcGxlLmNvbVxuICAgIGlmIChzbGFzaGVkUHJvdG9jb2xbcmVzdWx0LnByb3RvY29sXSAmJlxuICAgICAgICByZXN1bHQuaG9zdG5hbWUgJiYgIXJlc3VsdC5wYXRobmFtZSkge1xuICAgICAgcmVzdWx0LnBhdGggPSByZXN1bHQucGF0aG5hbWUgPSAnLyc7XG4gICAgfVxuXG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGlmIChyZWxhdGl2ZS5wcm90b2NvbCAmJiByZWxhdGl2ZS5wcm90b2NvbCAhPT0gcmVzdWx0LnByb3RvY29sKSB7XG4gICAgLy8gaWYgaXQncyBhIGtub3duIHVybCBwcm90b2NvbCwgdGhlbiBjaGFuZ2luZ1xuICAgIC8vIHRoZSBwcm90b2NvbCBkb2VzIHdlaXJkIHRoaW5nc1xuICAgIC8vIGZpcnN0LCBpZiBpdCdzIG5vdCBmaWxlOiwgdGhlbiB3ZSBNVVNUIGhhdmUgYSBob3N0LFxuICAgIC8vIGFuZCBpZiB0aGVyZSB3YXMgYSBwYXRoXG4gICAgLy8gdG8gYmVnaW4gd2l0aCwgdGhlbiB3ZSBNVVNUIGhhdmUgYSBwYXRoLlxuICAgIC8vIGlmIGl0IGlzIGZpbGU6LCB0aGVuIHRoZSBob3N0IGlzIGRyb3BwZWQsXG4gICAgLy8gYmVjYXVzZSB0aGF0J3Mga25vd24gdG8gYmUgaG9zdGxlc3MuXG4gICAgLy8gYW55dGhpbmcgZWxzZSBpcyBhc3N1bWVkIHRvIGJlIGFic29sdXRlLlxuICAgIGlmICghc2xhc2hlZFByb3RvY29sW3JlbGF0aXZlLnByb3RvY29sXSkge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhyZWxhdGl2ZSk7XG4gICAgICBmb3IgKHZhciB2ID0gMDsgdiA8IGtleXMubGVuZ3RoOyB2KyspIHtcbiAgICAgICAgdmFyIGsgPSBrZXlzW3ZdO1xuICAgICAgICByZXN1bHRba10gPSByZWxhdGl2ZVtrXTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICByZXN1bHQucHJvdG9jb2wgPSByZWxhdGl2ZS5wcm90b2NvbDtcbiAgICBpZiAoIXJlbGF0aXZlLmhvc3QgJiYgIWhvc3RsZXNzUHJvdG9jb2xbcmVsYXRpdmUucHJvdG9jb2xdKSB7XG4gICAgICB2YXIgcmVsUGF0aCA9IChyZWxhdGl2ZS5wYXRobmFtZSB8fCAnJykuc3BsaXQoJy8nKTtcbiAgICAgIHdoaWxlIChyZWxQYXRoLmxlbmd0aCAmJiAhKHJlbGF0aXZlLmhvc3QgPSByZWxQYXRoLnNoaWZ0KCkpKTtcbiAgICAgIGlmICghcmVsYXRpdmUuaG9zdCkgcmVsYXRpdmUuaG9zdCA9ICcnO1xuICAgICAgaWYgKCFyZWxhdGl2ZS5ob3N0bmFtZSkgcmVsYXRpdmUuaG9zdG5hbWUgPSAnJztcbiAgICAgIGlmIChyZWxQYXRoWzBdICE9PSAnJykgcmVsUGF0aC51bnNoaWZ0KCcnKTtcbiAgICAgIGlmIChyZWxQYXRoLmxlbmd0aCA8IDIpIHJlbFBhdGgudW5zaGlmdCgnJyk7XG4gICAgICByZXN1bHQucGF0aG5hbWUgPSByZWxQYXRoLmpvaW4oJy8nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LnBhdGhuYW1lID0gcmVsYXRpdmUucGF0aG5hbWU7XG4gICAgfVxuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgcmVzdWx0Lmhvc3QgPSByZWxhdGl2ZS5ob3N0IHx8ICcnO1xuICAgIHJlc3VsdC5hdXRoID0gcmVsYXRpdmUuYXV0aDtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSByZWxhdGl2ZS5ob3N0bmFtZSB8fCByZWxhdGl2ZS5ob3N0O1xuICAgIHJlc3VsdC5wb3J0ID0gcmVsYXRpdmUucG9ydDtcbiAgICAvLyB0byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICAgIGlmIChyZXN1bHQucGF0aG5hbWUgfHwgcmVzdWx0LnNlYXJjaCkge1xuICAgICAgdmFyIHAgPSByZXN1bHQucGF0aG5hbWUgfHwgJyc7XG4gICAgICB2YXIgcyA9IHJlc3VsdC5zZWFyY2ggfHwgJyc7XG4gICAgICByZXN1bHQucGF0aCA9IHAgKyBzO1xuICAgIH1cbiAgICByZXN1bHQuc2xhc2hlcyA9IHJlc3VsdC5zbGFzaGVzIHx8IHJlbGF0aXZlLnNsYXNoZXM7XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHZhciBpc1NvdXJjZUFicyA9IChyZXN1bHQucGF0aG5hbWUgJiYgcmVzdWx0LnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nKSxcbiAgICAgIGlzUmVsQWJzID0gKFxuICAgICAgICAgIHJlbGF0aXZlLmhvc3QgfHxcbiAgICAgICAgICByZWxhdGl2ZS5wYXRobmFtZSAmJiByZWxhdGl2ZS5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJ1xuICAgICAgKSxcbiAgICAgIG11c3RFbmRBYnMgPSAoaXNSZWxBYnMgfHwgaXNTb3VyY2VBYnMgfHxcbiAgICAgICAgICAgICAgICAgICAgKHJlc3VsdC5ob3N0ICYmIHJlbGF0aXZlLnBhdGhuYW1lKSksXG4gICAgICByZW1vdmVBbGxEb3RzID0gbXVzdEVuZEFicyxcbiAgICAgIHNyY1BhdGggPSByZXN1bHQucGF0aG5hbWUgJiYgcmVzdWx0LnBhdGhuYW1lLnNwbGl0KCcvJykgfHwgW10sXG4gICAgICByZWxQYXRoID0gcmVsYXRpdmUucGF0aG5hbWUgJiYgcmVsYXRpdmUucGF0aG5hbWUuc3BsaXQoJy8nKSB8fCBbXSxcbiAgICAgIHBzeWNob3RpYyA9IHJlc3VsdC5wcm90b2NvbCAmJiAhc2xhc2hlZFByb3RvY29sW3Jlc3VsdC5wcm90b2NvbF07XG5cbiAgLy8gaWYgdGhlIHVybCBpcyBhIG5vbi1zbGFzaGVkIHVybCwgdGhlbiByZWxhdGl2ZVxuICAvLyBsaW5rcyBsaWtlIC4uLy4uIHNob3VsZCBiZSBhYmxlXG4gIC8vIHRvIGNyYXdsIHVwIHRvIHRoZSBob3N0bmFtZSwgYXMgd2VsbC4gIFRoaXMgaXMgc3RyYW5nZS5cbiAgLy8gcmVzdWx0LnByb3RvY29sIGhhcyBhbHJlYWR5IGJlZW4gc2V0IGJ5IG5vdy5cbiAgLy8gTGF0ZXIgb24sIHB1dCB0aGUgZmlyc3QgcGF0aCBwYXJ0IGludG8gdGhlIGhvc3QgZmllbGQuXG4gIGlmIChwc3ljaG90aWMpIHtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSAnJztcbiAgICByZXN1bHQucG9ydCA9IG51bGw7XG4gICAgaWYgKHJlc3VsdC5ob3N0KSB7XG4gICAgICBpZiAoc3JjUGF0aFswXSA9PT0gJycpIHNyY1BhdGhbMF0gPSByZXN1bHQuaG9zdDtcbiAgICAgIGVsc2Ugc3JjUGF0aC51bnNoaWZ0KHJlc3VsdC5ob3N0KTtcbiAgICB9XG4gICAgcmVzdWx0Lmhvc3QgPSAnJztcbiAgICBpZiAocmVsYXRpdmUucHJvdG9jb2wpIHtcbiAgICAgIHJlbGF0aXZlLmhvc3RuYW1lID0gbnVsbDtcbiAgICAgIHJlbGF0aXZlLnBvcnQgPSBudWxsO1xuICAgICAgaWYgKHJlbGF0aXZlLmhvc3QpIHtcbiAgICAgICAgaWYgKHJlbFBhdGhbMF0gPT09ICcnKSByZWxQYXRoWzBdID0gcmVsYXRpdmUuaG9zdDtcbiAgICAgICAgZWxzZSByZWxQYXRoLnVuc2hpZnQocmVsYXRpdmUuaG9zdCk7XG4gICAgICB9XG4gICAgICByZWxhdGl2ZS5ob3N0ID0gbnVsbDtcbiAgICB9XG4gICAgbXVzdEVuZEFicyA9IG11c3RFbmRBYnMgJiYgKHJlbFBhdGhbMF0gPT09ICcnIHx8IHNyY1BhdGhbMF0gPT09ICcnKTtcbiAgfVxuXG4gIGlmIChpc1JlbEFicykge1xuICAgIC8vIGl0J3MgYWJzb2x1dGUuXG4gICAgcmVzdWx0Lmhvc3QgPSAocmVsYXRpdmUuaG9zdCB8fCByZWxhdGl2ZS5ob3N0ID09PSAnJykgP1xuICAgICAgICAgICAgICAgICAgcmVsYXRpdmUuaG9zdCA6IHJlc3VsdC5ob3N0O1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9IChyZWxhdGl2ZS5ob3N0bmFtZSB8fCByZWxhdGl2ZS5ob3N0bmFtZSA9PT0gJycpID9cbiAgICAgICAgICAgICAgICAgICAgICByZWxhdGl2ZS5ob3N0bmFtZSA6IHJlc3VsdC5ob3N0bmFtZTtcbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICAgIHNyY1BhdGggPSByZWxQYXRoO1xuICAgIC8vIGZhbGwgdGhyb3VnaCB0byB0aGUgZG90LWhhbmRsaW5nIGJlbG93LlxuICB9IGVsc2UgaWYgKHJlbFBhdGgubGVuZ3RoKSB7XG4gICAgLy8gaXQncyByZWxhdGl2ZVxuICAgIC8vIHRocm93IGF3YXkgdGhlIGV4aXN0aW5nIGZpbGUsIGFuZCB0YWtlIHRoZSBuZXcgcGF0aCBpbnN0ZWFkLlxuICAgIGlmICghc3JjUGF0aCkgc3JjUGF0aCA9IFtdO1xuICAgIHNyY1BhdGgucG9wKCk7XG4gICAgc3JjUGF0aCA9IHNyY1BhdGguY29uY2F0KHJlbFBhdGgpO1xuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gIH0gZWxzZSBpZiAoIXV0aWwuaXNOdWxsT3JVbmRlZmluZWQocmVsYXRpdmUuc2VhcmNoKSkge1xuICAgIC8vIGp1c3QgcHVsbCBvdXQgdGhlIHNlYXJjaC5cbiAgICAvLyBsaWtlIGhyZWY9Jz9mb28nLlxuICAgIC8vIFB1dCB0aGlzIGFmdGVyIHRoZSBvdGhlciB0d28gY2FzZXMgYmVjYXVzZSBpdCBzaW1wbGlmaWVzIHRoZSBib29sZWFuc1xuICAgIGlmIChwc3ljaG90aWMpIHtcbiAgICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlc3VsdC5ob3N0ID0gc3JjUGF0aC5zaGlmdCgpO1xuICAgICAgLy9vY2NhdGlvbmFseSB0aGUgYXV0aCBjYW4gZ2V0IHN0dWNrIG9ubHkgaW4gaG9zdFxuICAgICAgLy90aGlzIGVzcGVjaWFsbHkgaGFwcGVucyBpbiBjYXNlcyBsaWtlXG4gICAgICAvL3VybC5yZXNvbHZlT2JqZWN0KCdtYWlsdG86bG9jYWwxQGRvbWFpbjEnLCAnbG9jYWwyQGRvbWFpbjInKVxuICAgICAgdmFyIGF1dGhJbkhvc3QgPSByZXN1bHQuaG9zdCAmJiByZXN1bHQuaG9zdC5pbmRleE9mKCdAJykgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lmhvc3Quc3BsaXQoJ0AnKSA6IGZhbHNlO1xuICAgICAgaWYgKGF1dGhJbkhvc3QpIHtcbiAgICAgICAgcmVzdWx0LmF1dGggPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgICAgIHJlc3VsdC5ob3N0ID0gcmVzdWx0Lmhvc3RuYW1lID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICAgIC8vdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgICBpZiAoIXV0aWwuaXNOdWxsKHJlc3VsdC5wYXRobmFtZSkgfHwgIXV0aWwuaXNOdWxsKHJlc3VsdC5zZWFyY2gpKSB7XG4gICAgICByZXN1bHQucGF0aCA9IChyZXN1bHQucGF0aG5hbWUgPyByZXN1bHQucGF0aG5hbWUgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAocmVzdWx0LnNlYXJjaCA/IHJlc3VsdC5zZWFyY2ggOiAnJyk7XG4gICAgfVxuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBpZiAoIXNyY1BhdGgubGVuZ3RoKSB7XG4gICAgLy8gbm8gcGF0aCBhdCBhbGwuICBlYXN5LlxuICAgIC8vIHdlJ3ZlIGFscmVhZHkgaGFuZGxlZCB0aGUgb3RoZXIgc3R1ZmYgYWJvdmUuXG4gICAgcmVzdWx0LnBhdGhuYW1lID0gbnVsbDtcbiAgICAvL3RvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKHJlc3VsdC5zZWFyY2gpIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gJy8nICsgcmVzdWx0LnNlYXJjaDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LnBhdGggPSBudWxsO1xuICAgIH1cbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gaWYgYSB1cmwgRU5EcyBpbiAuIG9yIC4uLCB0aGVuIGl0IG11c3QgZ2V0IGEgdHJhaWxpbmcgc2xhc2guXG4gIC8vIGhvd2V2ZXIsIGlmIGl0IGVuZHMgaW4gYW55dGhpbmcgZWxzZSBub24tc2xhc2h5LFxuICAvLyB0aGVuIGl0IG11c3QgTk9UIGdldCBhIHRyYWlsaW5nIHNsYXNoLlxuICB2YXIgbGFzdCA9IHNyY1BhdGguc2xpY2UoLTEpWzBdO1xuICB2YXIgaGFzVHJhaWxpbmdTbGFzaCA9IChcbiAgICAgIChyZXN1bHQuaG9zdCB8fCByZWxhdGl2ZS5ob3N0IHx8IHNyY1BhdGgubGVuZ3RoID4gMSkgJiZcbiAgICAgIChsYXN0ID09PSAnLicgfHwgbGFzdCA9PT0gJy4uJykgfHwgbGFzdCA9PT0gJycpO1xuXG4gIC8vIHN0cmlwIHNpbmdsZSBkb3RzLCByZXNvbHZlIGRvdWJsZSBkb3RzIHRvIHBhcmVudCBkaXJcbiAgLy8gaWYgdGhlIHBhdGggdHJpZXMgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIGB1cGAgZW5kcyB1cCA+IDBcbiAgdmFyIHVwID0gMDtcbiAgZm9yICh2YXIgaSA9IHNyY1BhdGgubGVuZ3RoOyBpID49IDA7IGktLSkge1xuICAgIGxhc3QgPSBzcmNQYXRoW2ldO1xuICAgIGlmIChsYXN0ID09PSAnLicpIHtcbiAgICAgIHNyY1BhdGguc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgICB1cCsrO1xuICAgIH0gZWxzZSBpZiAodXApIHtcbiAgICAgIHNyY1BhdGguc3BsaWNlKGksIDEpO1xuICAgICAgdXAtLTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgcGF0aCBpcyBhbGxvd2VkIHRvIGdvIGFib3ZlIHRoZSByb290LCByZXN0b3JlIGxlYWRpbmcgLi5zXG4gIGlmICghbXVzdEVuZEFicyAmJiAhcmVtb3ZlQWxsRG90cykge1xuICAgIGZvciAoOyB1cC0tOyB1cCkge1xuICAgICAgc3JjUGF0aC51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChtdXN0RW5kQWJzICYmIHNyY1BhdGhbMF0gIT09ICcnICYmXG4gICAgICAoIXNyY1BhdGhbMF0gfHwgc3JjUGF0aFswXS5jaGFyQXQoMCkgIT09ICcvJykpIHtcbiAgICBzcmNQYXRoLnVuc2hpZnQoJycpO1xuICB9XG5cbiAgaWYgKGhhc1RyYWlsaW5nU2xhc2ggJiYgKHNyY1BhdGguam9pbignLycpLnN1YnN0cigtMSkgIT09ICcvJykpIHtcbiAgICBzcmNQYXRoLnB1c2goJycpO1xuICB9XG5cbiAgdmFyIGlzQWJzb2x1dGUgPSBzcmNQYXRoWzBdID09PSAnJyB8fFxuICAgICAgKHNyY1BhdGhbMF0gJiYgc3JjUGF0aFswXS5jaGFyQXQoMCkgPT09ICcvJyk7XG5cbiAgLy8gcHV0IHRoZSBob3N0IGJhY2tcbiAgaWYgKHBzeWNob3RpYykge1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlc3VsdC5ob3N0ID0gaXNBYnNvbHV0ZSA/ICcnIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyY1BhdGgubGVuZ3RoID8gc3JjUGF0aC5zaGlmdCgpIDogJyc7XG4gICAgLy9vY2NhdGlvbmFseSB0aGUgYXV0aCBjYW4gZ2V0IHN0dWNrIG9ubHkgaW4gaG9zdFxuICAgIC8vdGhpcyBlc3BlY2lhbGx5IGhhcHBlbnMgaW4gY2FzZXMgbGlrZVxuICAgIC8vdXJsLnJlc29sdmVPYmplY3QoJ21haWx0bzpsb2NhbDFAZG9tYWluMScsICdsb2NhbDJAZG9tYWluMicpXG4gICAgdmFyIGF1dGhJbkhvc3QgPSByZXN1bHQuaG9zdCAmJiByZXN1bHQuaG9zdC5pbmRleE9mKCdAJykgPiAwID9cbiAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5ob3N0LnNwbGl0KCdAJykgOiBmYWxzZTtcbiAgICBpZiAoYXV0aEluSG9zdCkge1xuICAgICAgcmVzdWx0LmF1dGggPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQuaG9zdCA9IHJlc3VsdC5ob3N0bmFtZSA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICB9XG4gIH1cblxuICBtdXN0RW5kQWJzID0gbXVzdEVuZEFicyB8fCAocmVzdWx0Lmhvc3QgJiYgc3JjUGF0aC5sZW5ndGgpO1xuXG4gIGlmIChtdXN0RW5kQWJzICYmICFpc0Fic29sdXRlKSB7XG4gICAgc3JjUGF0aC51bnNoaWZ0KCcnKTtcbiAgfVxuXG4gIGlmICghc3JjUGF0aC5sZW5ndGgpIHtcbiAgICByZXN1bHQucGF0aG5hbWUgPSBudWxsO1xuICAgIHJlc3VsdC5wYXRoID0gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQucGF0aG5hbWUgPSBzcmNQYXRoLmpvaW4oJy8nKTtcbiAgfVxuXG4gIC8vdG8gc3VwcG9ydCByZXF1ZXN0Lmh0dHBcbiAgaWYgKCF1dGlsLmlzTnVsbChyZXN1bHQucGF0aG5hbWUpIHx8ICF1dGlsLmlzTnVsbChyZXN1bHQuc2VhcmNoKSkge1xuICAgIHJlc3VsdC5wYXRoID0gKHJlc3VsdC5wYXRobmFtZSA/IHJlc3VsdC5wYXRobmFtZSA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAocmVzdWx0LnNlYXJjaCA/IHJlc3VsdC5zZWFyY2ggOiAnJyk7XG4gIH1cbiAgcmVzdWx0LmF1dGggPSByZWxhdGl2ZS5hdXRoIHx8IHJlc3VsdC5hdXRoO1xuICByZXN1bHQuc2xhc2hlcyA9IHJlc3VsdC5zbGFzaGVzIHx8IHJlbGF0aXZlLnNsYXNoZXM7XG4gIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICByZXR1cm4gcmVzdWx0O1xufTtcblxuVXJsLnByb3RvdHlwZS5wYXJzZUhvc3QgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGhvc3QgPSB0aGlzLmhvc3Q7XG4gIHZhciBwb3J0ID0gcG9ydFBhdHRlcm4uZXhlYyhob3N0KTtcbiAgaWYgKHBvcnQpIHtcbiAgICBwb3J0ID0gcG9ydFswXTtcbiAgICBpZiAocG9ydCAhPT0gJzonKSB7XG4gICAgICB0aGlzLnBvcnQgPSBwb3J0LnN1YnN0cigxKTtcbiAgICB9XG4gICAgaG9zdCA9IGhvc3Quc3Vic3RyKDAsIGhvc3QubGVuZ3RoIC0gcG9ydC5sZW5ndGgpO1xuICB9XG4gIGlmIChob3N0KSB0aGlzLmhvc3RuYW1lID0gaG9zdDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpc1N0cmluZzogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIHR5cGVvZihhcmcpID09PSAnc3RyaW5nJztcbiAgfSxcbiAgaXNPYmplY3Q6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiB0eXBlb2YoYXJnKSA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xuICB9LFxuICBpc051bGw6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBhcmcgPT09IG51bGw7XG4gIH0sXG4gIGlzTnVsbE9yVW5kZWZpbmVkOiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gYXJnID09IG51bGw7XG4gIH1cbn07XG4iLCIndXNlIHN0cmljdCdcbm1vZHVsZS5leHBvcnRzID0gY2hhaW5cblxuLyoqXG4gKiBDaGFpbiBhIHN0YWNrIG9mIHJpbGwgbWlkZGxld2FyZSBpbnRvIG9uZSBjb21wb3NlZCBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn1cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5mdW5jdGlvbiBjaGFpbiAoc3RhY2spIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHN0YWNrKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignUmlsbDogTWlkZGxld2FyZSBzdGFjayBtdXN0IGJlIGFuIGFycmF5LicpXG4gIHZhciBmbnMgPSBub3JtYWxpemUoc3RhY2ssIFtdKVxuXG4gIHJldHVybiBmdW5jdGlvbiBjaGFpbmVkIChjdHgsIG5leHQpIHtcbiAgICB2YXIgaW5kZXggPSAtMSAvLyBMYXN0IGNhbGxlZCBtaWRkbGV3YXJlLlxuICAgIHJldHVybiBkaXNwYXRjaCgwKVxuICAgIGZ1bmN0aW9uIGRpc3BhdGNoIChpKSB7XG4gICAgICBpZiAoaSA8PSBpbmRleCkgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignUmlsbDogbmV4dCgpIGNhbGxlZCBtdWx0aXBsZSB0aW1lcy4nKSlcblxuICAgICAgdmFyIGZuID0gZm5zW2ldIHx8IG5leHRcbiAgICAgIGluZGV4ID0gaVxuXG4gICAgICBpZiAoIWZuKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZuKGN0eCwgZnVuY3Rpb24gbmV4dCAoKSB7XG4gICAgICAgICAgcmV0dXJuIGRpc3BhdGNoKGkgKyAxKVxuICAgICAgICB9KSlcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFV0aWxpdHkgdG8gbm9ybWFsaXplIGEgbWlkZGxld2FyZSBzdGFjayBhbmQgY2hlY2sgZm9yIHZhbGlkaXR5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fVxuICogQHRocm93cyB7VHlwZUVycm9yfVxuICovXG5mdW5jdGlvbiBub3JtYWxpemUgKHN0YWNrLCBmbnMpIHtcbiAgdmFyIGZuXG4gIHZhciBsZW4gPSBzdGFjay5sZW5ndGhcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGZuID0gc3RhY2tbaV1cbiAgICBpZiAoIWZuKSBjb250aW51ZVxuICAgIGVsc2UgaWYgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJykgZm5zLnB1c2goZm4pXG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShmbikpIG5vcm1hbGl6ZShmbiwgZm5zKVxuICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZm4uc3RhY2spKSBub3JtYWxpemUoZm4uc3RhY2ssIGZucylcbiAgICBlbHNlIHRocm93IG5ldyBUeXBlRXJyb3IoJ1JpbGw6IE1pZGRsZXdhcmUgbXVzdCBiZSBhbiBmdW5jdGlvbnMuIEdvdCBhIFsnICsgZm4uY29uc3RydWN0b3IubmFtZSArICddLicpXG4gIH1cblxuICByZXR1cm4gZm5zXG59XG4iLCIndXNlIHN0cmljdCdcbnZhciBjb29raWVSZWcgPSAvICooW149O10rKSAqPT8gKihbXjtdKyk/L2dcblxuLyoqXG4gKiBQYXJzZXMgYSBjb29raWUgc3RyaW5nIGludG8gYW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBjb29raWVcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZXhwb3J0cy5wYXJzZSA9IGZ1bmN0aW9uIHBhcnNlIChjb29raWUpIHtcbiAgaWYgKHR5cGVvZiBjb29raWUgIT09ICdzdHJpbmcnKSByZXR1cm4ge31cblxuICB2YXIgcmVzdWx0ID0ge31cbiAgdmFyIG0sIGtleSwgdmFsXG4gIHdoaWxlICgobSA9IGNvb2tpZVJlZy5leGVjKGNvb2tpZSkpKSB7XG4gICAga2V5ID0gbVsxXVxuICAgIHZhbCA9IG1bMl1cbiAgICByZXN1bHRba2V5XSA9IHZhbFxuICAgICAgPyBkZWNvZGVVUklDb21wb25lbnQodmFsKVxuICAgICAgOiB1bmRlZmluZWRcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuLyoqXG4gKiBTZXJhbGl6ZSBlYWNoIGNvb2tpZSBpbiBhbiBhcnJheSBpbnRvIGEgY29va2llIHN0cmluZy5cbiAqIFB1bGwgb3V0IHZhbGlkIG9wdGlvbnMgZnJvbSBhbiBvcHRpb25zIG9iamVjdCBhbmQgcmV0dXJuIGEgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuc2VyaWFsaXplID0gZnVuY3Rpb24gc2VyaWFsaXplIChrZXksIHZhbCwgb3B0cykge1xuICB2YXIgcmVzdWx0ID0gW2tleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWwpXVxuXG4gIGlmIChvcHRzKSB7XG4gICAgaWYgKG9wdHMuZG9tYWluKSB7XG4gICAgICByZXN1bHQucHVzaCgnZG9tYWluPScgKyBvcHRzLmRvbWFpbilcbiAgICB9XG4gICAgaWYgKG9wdHMucGF0aCkge1xuICAgICAgcmVzdWx0LnB1c2goJ3BhdGg9JyArIG9wdHMucGF0aClcbiAgICB9XG4gICAgaWYgKG9wdHMuZXhwaXJlcykge1xuICAgICAgcmVzdWx0LnB1c2goJ2V4cGlyZXM9JyArIChcbiAgICAgICAgb3B0cy5leHBpcmVzLnRvVVRDU3RyaW5nXG4gICAgICAgICAgPyBvcHRzLmV4cGlyZXMudG9VVENTdHJpbmcoKVxuICAgICAgICAgIDogb3B0cy5leHBpcmVzXG4gICAgICAgICkpXG4gICAgfVxuICAgIGlmIChvcHRzLm1heEFnZSkge1xuICAgICAgcmVzdWx0LnB1c2goJ21heC1hZ2U9JyArIChvcHRzLm1heEFnZSB8IDApKVxuICAgIH1cbiAgICBpZiAob3B0cy5odHRwT25seSkge1xuICAgICAgcmVzdWx0LnB1c2goJ2h0dHBvbmx5JylcbiAgICB9XG4gICAgaWYgKG9wdHMuc2VjdXJlKSB7XG4gICAgICByZXN1bHQucHVzaCgnc2VjdXJlJylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0LmpvaW4oJzsgJylcbn1cbiIsIid1c2Ugc3RyaWN0J1xudmFyIFNUQVRVU19DT0RFUyA9IHJlcXVpcmUoJ0ByaWxsL2h0dHAnKS5TVEFUVVNfQ09ERVNcbkh0dHBFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3Jcbkh0dHBFcnJvci5mYWlsID0gZmFpbFxuSHR0cEVycm9yLmFzc2VydCA9IGFzc2VydFxubW9kdWxlLmV4cG9ydHMgPSBIdHRwRXJyb3JcblxuLyoqXG4gKiBDcmVhdGVzIGEgUmlsbCBIdHRwRXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSBjb2RlIC0gVGhlIHN0YXR1cyBjb2RlIGZvciB0aGUgZXJyb3IuXG4gKiBAcGFyYW0ge1N0cmluZ30gW21lc3NhZ2VdIC0gT3B0aW9uYWwgc3RhdHVzIG1lc3NhZ2UuXG4gKiBAcGFyYW0ge09iamVjdH0gW21ldGFdIC0gT3B0aW9uYWwgb2JqZWN0IHRvIG1lcmdlIG9udG8gdGhlIGVycm9yLlxuICovXG5mdW5jdGlvbiBIdHRwRXJyb3IgKGNvZGUsIG1lc3NhZ2UsIG1ldGEpIHtcbiAgaWYgKHR5cGVvZiBjb2RlICE9PSAnbnVtYmVyJykgdGhyb3cgbmV3IFR5cGVFcnJvcignUmlsbCNIdHRwRXJyb3IuZmFpbDogU3RhdHVzIGNvZGUgbXVzdCBiZSBhIG51bWJlci4nKVxuXG4gIHRoaXMubmFtZSA9ICdIdHRwRXJyb3InXG4gIHRoaXMuY29kZSA9IGNvZGVcbiAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZSB8fCBTVEFUVVNfQ09ERVNbY29kZV1cblxuICBmb3IgKHZhciBrZXkgaW4gbWV0YSkgdGhpc1trZXldID0gbWV0YVtrZXldXG4gIGlmIChFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSkgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgSHR0cEVycm9yKVxuICBlbHNlIEVycm9yLmNhbGwodGhpcylcbn1cblxuLyoqXG4gKiBUaHJvdyBhbiBodHRwIGVycm9yLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gY29kZSAtIFRoZSBzdGF0dXMgY29kZSBmb3IgdGhlIGVycm9yLlxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSAtIE9wdGlvbmFsIHN0YXR1cyBtZXNzYWdlLlxuICogQHBhcmFtIHtPYmplY3R9IFttZXRhXSAtIE9wdGlvbmFsIG9iamVjdCB0byBtZXJnZSBvbnRvIHRoZSBlcnJvci5cbiAqIEB0aHJvd3MgSHR0cEVycm9yXG4gKi9cbmZ1bmN0aW9uIGZhaWwgKGNvZGUsIG1lc3NhZ2UsIG1ldGEpIHtcbiAgdGhyb3cgbmV3IEh0dHBFcnJvcihjb2RlLCBtZXNzYWdlLCBtZXRhKVxufVxuXG4vKipcbiAqIFRocm93IGFuIGh0dHAgZXJyb3IgaWYgYSB2YWx1ZSBpcyBub3QgdHJ1dGh5LlxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsIC0gVGhlIHZhbHVlIHRvIHRlc3QgZm9yIHRydXRoeW5lc3MuXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IGNvZGUgLSBUaGUgc3RhdHVzIGNvZGUgZm9yIHRoZSBlcnJvci5cbiAqIEBwYXJhbSB7U3RyaW5nfSBbbWVzc2FnZV0gLSBPcHRpb25hbCBzdGF0dXMgbWVzc2FnZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbbWV0YV0gLSBPcHRpb25hbCBvYmplY3QgdG8gbWVyZ2Ugb250byB0aGUgZXJyb3IuXG4gKiBAdGhyb3dzIEh0dHBFcnJvclxuICovXG5mdW5jdGlvbiBhc3NlcnQgKHZhbCwgY29kZSwgbWVzc2FnZSwgbWV0YSkge1xuICBpZiAoIXZhbCkgZmFpbChjb2RlLCBtZXNzYWdlLCBtZXRhKVxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBVUkwgPSByZXF1aXJlKCd1cmwnKVxudmFyIHBhcnNlRm9ybSA9IHJlcXVpcmUoJ3BhcnNlLWZvcm0nKVxudmFyIGxvY2F0aW9uID0gd2luZG93Lmhpc3RvcnkubG9jYXRpb24gfHwgd2luZG93LmxvY2F0aW9uXG52YXIgcmVsUmVnID0gLyg/Ol58XFxzKylleHRlcm5hbCg/Olxccyt8JCkvXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBvblBvcFN0YXRlOiBvblBvcFN0YXRlLFxuICBvblN1Ym1pdDogb25TdWJtaXQsXG4gIG9uQ2xpY2s6IG9uQ2xpY2tcbn1cblxuLypcbiAqIEhhbmRsZSBhbiBhIHBvcCBzdGF0ZSAoYmFjaykgZXZlbnQuXG4gKi9cbmZ1bmN0aW9uIG9uUG9wU3RhdGUgKCkge1xuICB0aGlzLm5hdmlnYXRlKGxvY2F0aW9uLmhyZWYsIHsgcG9wU3RhdGU6IHRydWUgfSlcbn1cblxuLypcbiAqIEhhbmRsZSBpbnRlcmNlcHRpbmcgZm9ybXMgdG8gdXBkYXRlIHRoZSB1cmwuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGVcbiAqL1xuZnVuY3Rpb24gb25TdWJtaXQgKGUpIHtcbiAgLy8gSWdub3JlIGNhbmNlbGVkIGV2ZW50cy5cbiAgaWYgKGUuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuXG5cbiAgLy8gR2V0IHRoZSA8Zm9ybT4gZWxlbWVudC5cbiAgdmFyIGVsID0gZS50YXJnZXRcbiAgdmFyIHN1Ym1pdHRlZCA9IGZhbHNlXG4gIHZhciB0YXJnZXQgPSBnZXRBdHRyaWJ1dGUoZWwsICd0YXJnZXQnKVxuICB2YXIgYWN0aW9uID0gZ2V0QXR0cmlidXRlKGVsLCAnYWN0aW9uJylcbiAgdmFyIG1ldGhvZCA9IGdldEF0dHJpYnV0ZShlbCwgJ21ldGhvZCcpLnRvVXBwZXJDYXNlKClcbiAgdmFyIGRhdGEgPSBwYXJzZUZvcm0oZWwsIHRydWUpXG5cbiAgLy8gSWdub3JlIHRoZSBjbGljayBpZiB0aGUgZWxlbWVudCBoYXMgYSB0YXJnZXQuXG4gIGlmICh0YXJnZXQgJiYgdGFyZ2V0ICE9PSAnX3NlbGYnKSByZXR1cm5cblxuICBpZiAobWV0aG9kID09PSAnR0VUJykge1xuICAgIC8vIE9uIGEgZ2V0IHJlcXVlc3QgYSBmb3JtcyBib2R5IGlzIGNvbnZlcnRlZCBpbnRvIGEgcXVlcnkgc3RyaW5nLlxuICAgIHZhciBwYXJzZWQgPSBVUkwucGFyc2UoVVJMLnJlc29sdmUobG9jYXRpb24uaHJlZiwgYWN0aW9uKSlcbiAgICAvLyBXZSBkZWxldGUgdGhlIHNlYXJjaCBwYXJ0IHNvIHRoYXQgYSBxdWVyeSBvYmplY3QgY2FuIGJlIHVzZWQuXG4gICAgZGVsZXRlIHBhcnNlZC5zZWFyY2hcbiAgICBwYXJzZWQucXVlcnkgPSBkYXRhLmJvZHlcbiAgICBzdWJtaXR0ZWQgPSB0aGlzLm5hdmlnYXRlKFVSTC5mb3JtYXQocGFyc2VkKSlcbiAgfSBlbHNlIHtcbiAgICBzdWJtaXR0ZWQgPSB0aGlzLm5hdmlnYXRlKHtcbiAgICAgIHVybDogYWN0aW9uLFxuICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICBib2R5OiBkYXRhLmJvZHksXG4gICAgICBmaWxlczogZGF0YS5maWxlcyxcbiAgICAgIGhlYWRlcnM6IHsgJ2NvbnRlbnQtdHlwZSc6IGdldEF0dHJpYnV0ZShlbCwgJ2VuY3R5cGUnKSB9XG4gICAgfSlcbiAgfVxuXG4gIGlmIChzdWJtaXR0ZWQpIHtcbiAgICBpZiAoIWVsLmhhc0F0dHJpYnV0ZSgnZGF0YS1ub3Jlc2V0JykpIGVsLnJlc2V0KClcbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgfVxufVxuXG4vKlxuICogSGFuZGxlIGludGVyY2VwdGluZyBsaW5rIGNsaWNrcyB0byB1cGRhdGUgdGhlIHVybC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gZVxuICovXG5mdW5jdGlvbiBvbkNsaWNrIChlKSB7XG4gIC8vIElnbm9yZSBjYW5jZWxlZCBldmVudHMsIG1vZGlmaWVkIGNsaWNrcywgYW5kIHJpZ2h0IGNsaWNrcy5cbiAgaWYgKFxuICAgIGUuZGVmYXVsdFByZXZlbnRlZCB8fFxuICAgIGUubWV0YUtleSB8fFxuICAgIGUuY3RybEtleSB8fFxuICAgIGUuc2hpZnRLZXkgfHxcbiAgICBlLmJ1dHRvbiAhPT0gMFxuICAgICkgcmV0dXJuXG4gIC8vIEdldCB0aGUgY2xpY2tlZCBlbGVtZW50LlxuICB2YXIgZWwgPSBlLnRhcmdldFxuXG4gIC8vIENoZWNrIGZvciBzdWJtaXQgYnV0dG9uIGFuZCBlbnN1cmUgaXQgaGFzIGZvY3VzLlxuICAvLyBUaGlzIGZpeGVzIGFuIGlzc3VlIHdpdGggc2FmYXJpIHdoZXJlIGJ1dHRvbnMgbmV2ZXIgZ2V0IGZvY3VzLlxuICAvLyBGaXhlcyBmb3JtIHN1Ym1pc3Npb24gcGFyc2luZyB3aGVuIHVzaW5nIGJ1dHRvbnMgd2l0aCB2YWx1ZXMuXG4gIGlmIChlbC50eXBlID09PSAnc3VibWl0JyAmJiBlbCAhPT0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkge1xuICAgIGVsLmZvY3VzKClcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIEZpbmQgYW4gPGE+IGVsZW1lbnQgdGhhdCBtYXkgaGF2ZSBiZWVuIGNsaWNrZWQuXG4gIHdoaWxlIChlbCAhPSBudWxsICYmIGVsLm5vZGVOYW1lICE9PSAnQScpIGVsID0gZWwucGFyZW50Tm9kZVxuXG4gIC8vIElnbm9yZSBpZiB3ZSBjb3VsZG4ndCBmaW5kIGEgbGluay5cbiAgaWYgKCFlbCkgcmV0dXJuXG5cbiAgdmFyIGhyZWYgPSBnZXRBdHRyaWJ1dGUoZWwsICdocmVmJylcbiAgdmFyIHRhcmdldCA9IGdldEF0dHJpYnV0ZShlbCwgJ3RhcmdldCcpXG4gIHZhciByZWwgPSBnZXRBdHRyaWJ1dGUoZWwsICdyZWwnKVxuXG4gIC8vIElnbm9yZSBjbGlja3MgZnJvbSBsaW5rbGVzcyBlbGVtZW50c1xuICBpZiAoIWhyZWYpIHJldHVyblxuICAvLyBJZ25vcmUgdGhlIGNsaWNrIGlmIHRoZSBlbGVtZW50IGhhcyBhIHRhcmdldC5cbiAgaWYgKHRhcmdldCAmJiB0YXJnZXQgIT09ICdfc2VsZicpIHJldHVyblxuICAvLyBJZ25vcmUgJ3JlbD1cImV4dGVybmFsXCInIGxpbmtzLlxuICBpZiAocmVsUmVnLnRlc3QocmVsKSkgcmV0dXJuXG4gIC8vIElnbm9yZSBkb3dubG9hZGFibGUgbGlua3MuXG4gIGlmIChlbC5oYXNBdHRyaWJ1dGUoJ2Rvd25sb2FkJykpIHJldHVyblxuICAvLyBBdHRlbXB0IHRvIG5hdmlnYXRlIGludGVybmFsbHkuXG4gIGlmICh0aGlzLm5hdmlnYXRlKGhyZWYpKSBlLnByZXZlbnREZWZhdWx0KClcbn1cblxuLypcbiAqIEJldHRlciBnZXQgYXR0cmlidXRlIHdpdGggZmFsbCBiYWNrcy5cbiAqIEluIHNvbWUgYnJvd3NlcnMgZGVmYXVsdCB2YWx1ZXMgbGlrZSBhIGZvcm1zIG1ldGhvZCBhcmUgbm90IHByb3BpZ2F0ZWQgdG8gZ2V0QXR0cmlidXRlLlxuICogVGhpcyB3aWxsIGNoZWNrIGEgZm9ybXMgYXR0cmlidXRlIGFuZCBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7SFRNTEVudGlyeX0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBhdHRyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZSAoZWwsIGF0dHIpIHtcbiAgdmFyIHZhbCA9IGVsLmdldEF0dHJpYnV0ZShhdHRyKSB8fCBlbFthdHRyXVxuICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ3N0cmluZycgPyB2YWwgOiAnJ1xufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBTZXJ2ZXIgPSByZXF1aXJlKCcuL3NlcnZlcicpXG52YXIgSW5jb21pbmdNZXNzYWdlID0gcmVxdWlyZSgnLi9yZXF1ZXN0LmpzJylcbnZhciBTZXJ2ZXJSZXNwb25zZSA9IHJlcXVpcmUoJy4vcmVzcG9uc2UuanMnKVxuXG52YXIgU1RBVFVTX0NPREVTID0gcmVxdWlyZSgnc3RhdHVzZXMvY29kZXMuanNvbicpXG52YXIgTUVUSE9EUyA9IFtcbiAgJ0NIRUNLT1VUJyxcbiAgJ0NPTk5FQ1QnLFxuICAnQ09QWScsXG4gICdERUxFVEUnLFxuICAnR0VUJyxcbiAgJ0hFQUQnLFxuICAnTE9DSycsXG4gICdNLVNFQVJDSCcsXG4gICdNRVJHRScsXG4gICdNS0FDVElWSVRZJyxcbiAgJ01LQ0FMRU5EQVInLFxuICAnTUtDT0wnLFxuICAnTU9WRScsXG4gICdOT1RJRlknLFxuICAnT1BUSU9OUycsXG4gICdQQVRDSCcsXG4gICdQT1NUJyxcbiAgJ1BST1BGSU5EJyxcbiAgJ1BST1BQQVRDSCcsXG4gICdQVVJHRScsXG4gICdQVVQnLFxuICAnUkVQT1JUJyxcbiAgJ1NFQVJDSCcsXG4gICdTVUJTQ1JJQkUnLFxuICAnVFJBQ0UnLFxuICAnVU5MT0NLJyxcbiAgJ1VOU1VCU0NSSUJFJ1xuXVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgU1RBVFVTX0NPREVTOiBTVEFUVVNfQ09ERVMsXG4gIE1FVEhPRFM6IE1FVEhPRFMsXG4gIFNlcnZlcjogU2VydmVyLFxuICBJbmNvbWluZ01lc3NhZ2U6IEluY29taW5nTWVzc2FnZSxcbiAgU2VydmVyUmVzcG9uc2U6IFNlcnZlclJlc3BvbnNlLFxuICBjcmVhdGVTZXJ2ZXI6IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlciAoKSB7XG4gICAgdmFyIGNiID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXVxuICAgIHJldHVybiBuZXcgU2VydmVyKGNiKVxuICB9XG59XG4iLCIndXNlIHN0cmljdCdcblxudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlclxudmFyIGxvY2F0aW9uID0gd2luZG93Lmhpc3RvcnkubG9jYXRpb24gfHwgd2luZG93LmxvY2F0aW9uXG5cbi8vIFRPRE86IE1ha2Ugb3B0aW9ucyBvbmx5IHRoZSBzb2NrZXQgYW5kIG1hbnVhbGx5IHNldCBldmVyeXRoaW5nIGVsc2UuXG4vLyBBUEkgU3ltbWV0cnkuXG5mdW5jdGlvbiBJbmNvbWluZ01lc3NhZ2UgKG9wdHMpIHtcbiAgdGhpcy51cmwgPSBvcHRzLnVybFxuICB0aGlzLm1ldGhvZCA9IG9wdHMubWV0aG9kIHx8ICdHRVQnXG4gIHRoaXMuaGVhZGVycyA9IG9wdHMuaGVhZGVycyB8fCB7fVxuICB0aGlzLmhlYWRlcnNbJ3JlZmVyZXInXSA9IG9wdHMucmVmZXJyZXJcbiAgdGhpcy5oZWFkZXJzWydkYXRlJ10gPSAobmV3IERhdGUoKSkudG9VVENTdHJpbmcoKVxuICB0aGlzLmhlYWRlcnNbJ2hvc3QnXSA9IGxvY2F0aW9uLmhvc3RcbiAgdGhpcy5oZWFkZXJzWydjb29raWUnXSA9IGRvY3VtZW50LmNvb2tpZVxuICB0aGlzLmhlYWRlcnNbJ3VzZXItYWdlbnQnXSA9IG5hdmlnYXRvci51c2VyQWdlbnRcbiAgdGhpcy5oZWFkZXJzWydhY2NlcHQtbGFuZ3VhZ2UnXSA9IG5hdmlnYXRvci5sYW5ndWFnZVxuICB0aGlzLmhlYWRlcnNbJ2Nvbm5lY3Rpb24nXSA9ICdrZWVwLWFsaXZlJ1xuICB0aGlzLmhlYWRlcnNbJ2NhY2hlLWNvbnRyb2wnXSA9ICdtYXgtYWdlPTAnXG4gIHRoaXMuaGVhZGVyc1snYWNjZXB0J10gPSAnKi8qJ1xuICB0aGlzLmNvbm5lY3Rpb24gPSB7XG4gICAgcmVtb3RlQWRkcmVzczogJzEyNy4wLjAuMScsXG4gICAgZW5jcnlwdGVkOiBsb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOidcbiAgfVxuICB0aGlzLmJvZHkgPSBvcHRzLmJvZHlcbiAgdGhpcy5maWxlcyA9IG9wdHMuZmlsZXNcbn1cbnZhciBwcm90byA9IEluY29taW5nTWVzc2FnZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpXG5cbi8vIERlZmF1bHRzXG5wcm90by5odHRwVmVyc2lvbk1ham9yID0gMVxucHJvdG8uaHR0cFZlcnNpb25NaW5vciA9IDFcbnByb3RvLmh0dHBWZXJzaW9uID0gcHJvdG8uaHR0cFZlcnNpb25NYWpvciArICcuJyArIHByb3RvLmh0dHBWZXJzaW9uTWlub3JcbnByb3RvLmNvbXBsZXRlID0gZmFsc2VcblxubW9kdWxlLmV4cG9ydHMgPSBJbmNvbWluZ01lc3NhZ2VcbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyXG52YXIgU1RBVFVTX0NPREVTID0gcmVxdWlyZSgnc3RhdHVzZXMvY29kZXMuanNvbicpXG52YXIgbm9vcCA9IGZ1bmN0aW9uICgpIHt9XG5cbmZ1bmN0aW9uIFNlcnZlclJlc3BvbnNlIChvcHRzKSB7XG4gIHRoaXMuX2hlYWRlcnMgPSB7fVxufVxudmFyIHByb3RvID0gU2VydmVyUmVzcG9uc2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKVxuXG4vLyBEZWZhdWx0cy5cbnByb3RvLnN0YXR1c0NvZGUgPSBudWxsXG5wcm90by5zdGF0dXNNZXNzYWdlID0gbnVsbFxucHJvdG8uc2VuZERhdGUgPSB0cnVlXG5wcm90by5maW5pc2hlZCA9IGZhbHNlXG5cbi8qKlxuICogTWFrZSBzb21lIG1ldGhvZHMgbm9vcHMuXG4gKi9cbnByb3RvLndyaXRlID1cbnByb3RvLndyaXRlQ29udGludWUgPVxucHJvdG8uc2V0VGltZW91dCA9XG5wcm90by5hZGRUcmFpbGVycyA9IG5vb3BcblxuLyoqXG4gKiBXcml0ZSBzdGF0dXMsIHN0YXR1cyBtZXNzYWdlIGFuZCBoZWFkZXJzIHRoZSBzYW1lIGFzIG5vZGUganMuXG4gKi9cbnByb3RvLndyaXRlSGVhZCA9IGZ1bmN0aW9uIHdyaXRlSGVhZCAoc3RhdHVzQ29kZSwgc3RhdHVzTWVzc2FnZSwgaGVhZGVycykge1xuICBpZiAodGhpcy5maW5pc2hlZCkgcmV0dXJuXG5cbiAgdGhpcy5zdGF0dXNDb2RlID0gc3RhdHVzQ29kZVxuICB0aGlzLmhlYWRlcnNTZW50ID0gdHJ1ZVxuICBpZiAoc3RhdHVzTWVzc2FnZSkge1xuICAgIGlmICh0eXBlb2Ygc3RhdHVzTWVzc2FnZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGhlYWRlcnMgPSBzdGF0dXNNZXNzYWdlXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RhdHVzTWVzc2FnZSA9IHN0YXR1c01lc3NhZ2VcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZW9mIGhlYWRlcnMgPT09ICdvYmplY3QnKSB7XG4gICAgZm9yICh2YXIga2V5IGluIGhlYWRlcnMpIHtcbiAgICAgIHRoaXMuc2V0SGVhZGVyKGtleSwgaGVhZGVyc1trZXldKVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEdldCBhIGhlYWRlciB0aGUgc2FtZSBhcyBub2RlIGpzLlxuICovXG5wcm90by5nZXRIZWFkZXIgPSBmdW5jdGlvbiBnZXRIZWFkZXIgKGhlYWRlcikge1xuICByZXR1cm4gdGhpcy5faGVhZGVyc1toZWFkZXIudG9Mb3dlckNhc2UoKV1cbn1cblxuLyoqXG4gKiBSZW1vdmUgYSBoZWFkZXIgdGhlIHNhbWUgYXMgbm9kZSBqcy5cbiAqL1xucHJvdG8ucmVtb3ZlSGVhZGVyID0gZnVuY3Rpb24gcmVtb3ZlSGVhZGVyIChoZWFkZXIpIHtcbiAgZGVsZXRlIHRoaXMuX2hlYWRlcnNbaGVhZGVyLnRvTG93ZXJDYXNlKCldXG59XG5cbi8qKlxuICogV3JpdGUgYSBoZWFkZXIgdGhlIHNhbWUgYXMgbm9kZSBqcy5cbiAqL1xucHJvdG8uc2V0SGVhZGVyID0gZnVuY3Rpb24gc2V0SGVhZGVyIChoZWFkZXIsIHZhbHVlKSB7XG4gIHRoaXMuX2hlYWRlcnNbaGVhZGVyLnRvTG93ZXJDYXNlKCldID0gdmFsdWVcbn1cblxuLyoqXG4gKiBIYW5kbGUgZXZlbnQgZW5kaW5nIHRoZSBzYW1lIGFzIG5vZGUganMuXG4gKi9cbnByb3RvLmVuZCA9IGZ1bmN0aW9uIGVuZCAoKSB7XG4gIGlmICh0aGlzLmZpbmlzaGVkKSByZXR1cm5cblxuICBpZiAodGhpcy5zdGF0dXNNZXNzYWdlID09IG51bGwpIHtcbiAgICB0aGlzLnN0YXR1c01lc3NhZ2UgPSBTVEFUVVNfQ09ERVNbdGhpcy5zdGF0dXNDb2RlXVxuICB9XG5cbiAgaWYgKHRoaXMuc2VuZERhdGUpIHtcbiAgICB0aGlzLl9oZWFkZXJzWydkYXRlJ10gPSAobmV3IERhdGUoKSkudG9VVENTdHJpbmcoKVxuICB9XG5cbiAgdGhpcy5faGVhZGVyc1snc3RhdHVzJ10gPSB0aGlzLnN0YXR1c0NvZGVcbiAgdGhpcy5oZWFkZXJzU2VudCA9IHRydWVcbiAgdGhpcy5maW5pc2hlZCA9IHRydWVcbiAgdGhpcy5lbWl0KCdmaW5pc2gnKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNlcnZlclJlc3BvbnNlXG4iLCIndXNlIHN0cmljdCdcblxudmFyIFVSTCA9IHJlcXVpcmUoJ3VybCcpXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyXG52YXIgaGFuZGxlcnMgPSByZXF1aXJlKCcuL2hhbmRsZXJzJylcbnZhciBSZXF1ZXN0ID0gcmVxdWlyZSgnLi9yZXF1ZXN0LmpzJylcbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoJy4vcmVzcG9uc2UuanMnKVxudmFyIGhpc3RvcnkgPSB3aW5kb3cuaGlzdG9yeVxudmFyIGxvY2F0aW9uID0gaGlzdG9yeS5sb2NhdGlvbiB8fCB3aW5kb3cubG9jYXRpb25cbnZhciBoYXNoUmVnID0gLyMoLispJC9cbnZhciBzZXJ2ZXIgPSBTZXJ2ZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKVxudmFyIHJlZmVycmVyID0gZG9jdW1lbnQucmVmZXJyZXJcblxuLyoqXG4gKiBFbXVsYXRlcyBub2RlIGpzIGh0dHAgc2VydmVyIGluIHRoZSBicm93c2VyLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZSAtIHRoZSBoYW5kbGUgZm9yIGEgcmVxdWVzdC5cbiAqL1xuZnVuY3Rpb24gU2VydmVyIChoYW5kbGVyKSB7XG4gIHRoaXMuX2hhbmRsZSA9IHRoaXNcbiAgdGhpcy5fcGVuZGluZ19yZWZyZXNoID0gbnVsbFxuICBpZiAoaGFuZGxlcikge1xuICAgIGlmICh0eXBlb2YgaGFuZGxlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJylcbiAgICB9XG4gICAgdGhpcy5vbigncmVxdWVzdCcsIGhhbmRsZXIpXG4gIH1cbn1cblxuLyoqXG4gKiBMaXN0ZW4gdG8gYWxsIHVybCBjaGFuZ2UgZXZlbnRzIG9uIGEgZG9tIGVsZW1lbnQgYW5kIHRyaWdnZXIgdGhlIHNlcnZlciBjYWxsYmFjay5cbiAqL1xuc2VydmVyLmxpc3RlbiA9IGZ1bmN0aW9uIGxpc3RlbiAoKSB7XG4gIC8vIEF1dG9tYXRpY2FsbHkgYWRkIGNhbGxiYWNrIGBsaXN0ZW5gIGhhbmRsZXIuXG4gIHZhciBjYiA9IGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV1cbiAgaWYgKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgdGhpcy5vbmNlKCdsaXN0ZW5pbmcnLCBjYilcblxuICAvLyBTZXR1cCBsaW5rL2Zvcm0gaGlqYWNrZXJzLlxuICB0aGlzLl9vblBvcFN0YXRlID0gaGFuZGxlcnMub25Qb3BTdGF0ZS5iaW5kKHRoaXMpXG4gIHRoaXMuX29uU3VibWl0ID0gaGFuZGxlcnMub25TdWJtaXQuYmluZCh0aGlzKVxuICB0aGlzLl9vbkNsaWNrID0gaGFuZGxlcnMub25DbGljay5iaW5kKHRoaXMpXG5cbiAgLy8gU2V0dXAgaW5pdGlhbCBsb2FkIGV2ZW50IGFuZCB0cmVhdCBpdCBhcyBwb3BzdGF0ZS5cbiAgdGhpcy5vbmNlKCdsaXN0ZW5pbmcnLCB0aGlzLl9vblBvcFN0YXRlKVxuXG4gIC8vIEVuc3VyZSB0aGF0IGxpc3RlbmluZyBpcyBgYXN5bmNgLlxuICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAvLyBNYXJrIHNlcnZlciBhcyBsaXN0ZW5pbmcuXG4gICAgdGhpcy5saXN0ZW5pbmcgPSB0cnVlXG4gICAgdGhpcy5lbWl0KCdsaXN0ZW5pbmcnKVxuICAgIC8vIFJlZ2lzdGVyIGxpbmsvZm9ybSBoaWphY2tlcnMuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgdGhpcy5fb25Qb3BTdGF0ZSlcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgdGhpcy5fb25TdWJtaXQpXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5fb25DbGljaylcbiAgfS5iaW5kKHRoaXMpLCAwKVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogQ2xvc2VzIHRoZSBzZXJ2ZXIgYW5kIGRlc3Ryb3lzIGFsbCBldmVudCBsaXN0ZW5lcnMuXG4gKi9cbnNlcnZlci5jbG9zZSA9IGZ1bmN0aW9uIGNsb3NlICgpIHtcbiAgLy8gQXV0b21hdGljYWxseSBhZGQgY2FsbGJhY2sgYGNsb3NlYCBoYW5kbGVyLlxuICB2YXIgY2IgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdXG4gIGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHRoaXMub25jZSgnY2xvc2UnLCBjYilcblxuICAvLyBFbnN1cmUgdGhhdCBjbG9zaW5nIGlzIGBhc3luY2AuXG4gIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgIC8vIFVucmVnaXN0ZXIgbGluay9mb3JtIGhpamFja2Vycy5cbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCB0aGlzLl9vblBvcFN0YXRlKVxuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdzdWJtaXQnLCB0aGlzLl9vblN1Ym1pdClcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9vbkNsaWNrKVxuICAgIC8vIE1hcmsgc2VydmVyIGFzIGNsb3NlZC5cbiAgICB0aGlzLmxpc3RlbmluZyA9IGZhbHNlXG4gICAgdGhpcy5lbWl0KCdjbG9zZScpXG4gIH0uYmluZCh0aGlzKSwgMClcblxuICByZXR1cm4gdGhpc1xufVxuXG4vKlxuICogVHJpZ2dlciB0aGUgcmVnaXN0ZXJlZCBoYW5kbGUgdG8gbmF2aWdhdGUgdG8gYSBnaXZlbiB1cmwuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSByZXFcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9wdHMucG9wU3RhdGVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5zZXJ2ZXIubmF2aWdhdGUgPSBmdW5jdGlvbiBuYXZpZ2F0ZSAocmVxLCBvcHRzKSB7XG4gIC8vIE1ha2Ugb3B0aW9ucyBvcHRpb25hbC5cbiAgaWYgKHR5cGVvZiBvcHRzICE9PSAnb2JqZWN0Jykgb3B0cyA9IHt9XG4gIC8vIEFsbG93IG5hdmlnYXRpb24gd2l0aCB1cmwgb25seS5cbiAgaWYgKHR5cGVvZiByZXEgPT09ICdzdHJpbmcnKSByZXEgPSB7IHVybDogcmVxIH1cblxuICAvLyBJZ25vcmUgbGlua3MgdGhhdCBkb24ndCBzaGFyZSBhIHByb3RvY29sIG9yIGhvc3Qgd2l0aCB0aGUgYnJvd3NlcnMuXG4gIHZhciBocmVmID0gVVJMLnJlc29sdmUobG9jYXRpb24uaHJlZiwgcmVxLnVybClcbiAgdmFyIHBhcnNlZCA9IFVSTC5wYXJzZShocmVmKVxuICAvLyBJZ25vcmUgbGlua3MgZm9yIGRpZmZlcmVudCBob3N0cy5cbiAgaWYgKHBhcnNlZC5ob3N0ICE9PSBsb2NhdGlvbi5ob3N0KSByZXR1cm4gZmFsc2VcbiAgLy8gSWdub3JlIGxpbmtzIHdpdGggYSBkaWZmZXJlbnQgcHJvdG9jb2wuXG4gIGlmIChwYXJzZWQucHJvdG9jb2wgIT09IGxvY2F0aW9uLnByb3RvY29sKSByZXR1cm4gZmFsc2VcblxuICAvLyBFbnN1cmUgdGhhdCB0aGUgdXJsIGlzIG5vZGVqcyBsaWtlIChzdGFydHMgd2l0aCBpbml0aWFsIGZvcndhcmQgc2xhc2gpIGJ1dCBoYXMgdGhlIGhhc2ggcG9ydGlvbi5cbiAgcmVxLnVybCA9IHBhcnNlZC5wYXRoICsgKHBhcnNlZC5oYXNoIHx8ICcnKVxuICAvLyBBdHRhY2ggcmVmZXJyZXIgKHN0b3JlZCBvbiBlYWNoIHJlcXVlc3QpLlxuICByZXEucmVmZXJyZXIgPSByZWZlcnJlclxuXG4gIC8vIENyZWF0ZSBhIG5vZGVqcyBzdHlsZSByZXEgYW5kIHJlcy5cbiAgcmVxID0gbmV3IFJlcXVlc3QocmVxKVxuICB2YXIgcmVzID0gbmV3IFJlc3BvbnNlKClcblxuICAvLyBXYWl0IGZvciByZXF1ZXN0IHRvIGJlIHNlbnQuXG4gIHJlcy5vbmNlKCdmaW5pc2gnLCBmdW5jdGlvbiBvbkVuZCAoKSB7XG4gICAgLy8gTm9kZSBtYXJrcyByZXF1ZXN0cyBhcyBjb21wbGV0ZS5cbiAgICByZXEuY29tcGxldGUgPSB0cnVlXG4gICAgcmVxLmVtaXQoJ2VuZCcpXG5cbiAgICAvLyBBbnkgbmF2aWdhdGlvbiBkdXJpbmcgYSAncmVmcmVzaCcgd2lsbCBjYW5jZWwgdGhlIHJlZnJlc2guXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX3BlbmRpbmdfcmVmcmVzaClcblxuICAgIC8vIENoZWNrIGlmIHdlIHNob3VsZCBzZXQgc29tZSBjb29raWVzLlxuICAgIGlmIChyZXMuZ2V0SGVhZGVyKCdzZXQtY29va2llJykpIHtcbiAgICAgIHZhciBjb29raWVzID0gcmVzLmdldEhlYWRlcignc2V0LWNvb2tpZScpXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShjb29raWVzKSkge1xuICAgICAgICAvLyBTZXQgbXVsdGlwbGUgY29va2llIGhlYWRlci5cbiAgICAgICAgY29va2llcy5mb3JFYWNoKGZ1bmN0aW9uIChjb29raWUpIHsgZG9jdW1lbnQuY29va2llID0gY29va2llIH0pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTZXQgYSBzaW5nbGUgY29va2llLlxuICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjb29raWVzXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdG8gc2VlIGlmIGEgcmVmcmVzaCB3YXMgcmVxdWVzdGVkLlxuICAgIGlmIChyZXMuZ2V0SGVhZGVyKCdyZWZyZXNoJykpIHtcbiAgICAgIHZhciBwYXJ0cyA9IHJlcy5nZXRIZWFkZXIoJ3JlZnJlc2gnKS5zcGxpdCgnIHVybD0nKVxuICAgICAgdmFyIHRpbWVvdXQgPSBwYXJzZUludChwYXJ0c1swXSkgKiAxMDAwXG4gICAgICB2YXIgcmVkaXJlY3RVUkwgPSBwYXJ0c1sxXVxuICAgICAgLy8gVGhpcyBoYW5kbGVzIHJlZnJlc2ggaGVhZGVycyBzaW1pbGFyIHRvIGJyb3dzZXJzIGJ5IHdhaXRpbmcgYSB0aW1lb3V0LCB0aGVuIG5hdmlnYXRpbmcuXG4gICAgICB0aGlzLl9wZW5kaW5nX3JlZnJlc2ggPSBzZXRUaW1lb3V0KFxuICAgICAgICB0aGlzLm5hdmlnYXRlLmJpbmQodGhpcywgcmVkaXJlY3RVUkwpLFxuICAgICAgICB0aW1lb3V0XG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHdlIHNob3VsZCByZWRpcmVjdC5cbiAgICBpZiAocmVzLmdldEhlYWRlcignbG9jYXRpb24nKSkge1xuICAgICAgc2V0VGltZW91dCh0aGlzLm5hdmlnYXRlLmJpbmQodGhpcywgcmVzLmdldEhlYWRlcignbG9jYXRpb24nKSksIDApXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBFbnN1cmUgcmVmZXJyZXIgZ2V0cyB1cGRhdGVkIGZvciBub24tcmVkaXJlY3RzLlxuICAgIHJlZmVycmVyID0gaHJlZlxuXG4gICAgLy8gV2UgZG9uJ3QgZG8gaGFzaCBzY3JvbGxpbmcgdW5sZXNzIGl0IGlzIGEgZ2V0IHJlcXVlc3QuXG4gICAgaWYgKHJlcS5tZXRob2QgIT09ICdHRVQnKSByZXR1cm5cblxuICAgIC8vIHBvcHN0YXRlIHN0YXRlIGlzIGhhbmRsZWQgYnkgdGhlIGJyb3dzZXIuXG4gICAgaWYgKG9wdHMucG9wU3RhdGUpIHJldHVyblxuXG4gICAgLypcbiAgICAgKiBXaGVuIG5hdmlnYXRpbmcgYSB1c2VyIHdpbGwgYmUgYnJvdWdodCB0byB0aGUgdG9wIG9mIHRoZSBwYWdlLlxuICAgICAqIElmIHRoZSB1cmxzIGNvbnRhaW5zIGEgaGFzaCB0aGF0IGlzIHRoZSBpZCBvZiBhbiBlbGVtZW50IChhIHRhcmdldCkgdGhlbiB0aGUgdGFyZ2V0IHdpbGwgYmUgc2Nyb2xsZWQgdG8uXG4gICAgICogVGhpcyBpcyBzaW1pbGFyIHRvIGhvdyBicm93c2VycyBoYW5kbGUgcGFnZSB0cmFuc2l0aW9ucyBuYXRpdmVseS5cbiAgICAgKi9cbiAgICB2YXIgaGFzaCA9IHJlcS51cmwubWF0Y2goaGFzaFJlZylcbiAgICBpZiAoaGFzaCA9PSBudWxsKSB3aW5kb3cuc2Nyb2xsVG8oMCwgMClcbiAgICBlbHNlIHtcbiAgICAgIHZhciB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChoYXNoWzFdKVxuICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICB0YXJnZXQuc2Nyb2xsSW50b1ZpZXcoe1xuICAgICAgICAgIGJsb2NrOiAnc3RhcnQnLFxuICAgICAgICAgIC8vIE9ubHkgdXNlIHNtb290aCBzY3JvbGxpbmcgaWYgd2UgYXJlIG9uIHRoZSBwYWdlIGFscmVhZHkuXG4gICAgICAgICAgYmVoYXZpb3I6IChcbiAgICAgICAgICAgIGxvY2F0aW9uLnBhdGhuYW1lID09PSBwYXJzZWQucGF0aG5hbWUgJiZcbiAgICAgICAgICAgIChsb2NhdGlvbi5zZWFyY2ggfHwgJycpID09PSAocGFyc2VkLnNlYXJjaCB8fCAnJylcbiAgICAgICAgICApID8gJ3Ntb290aCcgOiAnYXV0bydcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBEb24ndCBwdXNoIHRoZSBzYW1lIHVybCB0d2ljZS5cbiAgICBpZiAocmVxLmhlYWRlcnMucmVmZXJlciA9PT0gcmVxLnVybCkgcmV0dXJuXG5cbiAgICAvLyBVcGRhdGUgdGhlIGhyZWYgaW4gdGhlIGJyb3dzZXIuXG4gICAgaGlzdG9yeS5wdXNoU3RhdGUobnVsbCwgZG9jdW1lbnQudGl0bGUsIHJlcS51cmwpXG4gIH0uYmluZCh0aGlzKSlcblxuICB0aGlzLmVtaXQoJ3JlcXVlc3QnLCByZXEsIHJlcylcbiAgcmV0dXJuIHRoaXNcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTZXJ2ZXJcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCJAcmlsbC9odHRwXCIpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qXG4gKiBDYWxjdWxhdGUgdGhlIGJ5dGUgbGVuZ3RocyBmb3IgdXRmOCBlbmNvZGVkIHN0cmluZ3MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7TnVtYmVyfVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cikge1xuICB2YXIgaSwgbGVuO1xuICBpZiAoIXN0cikgcmV0dXJuIDA7XG4gIHN0ciA9IHN0ci50b1N0cmluZygpO1xuXG4gIGZvciAoaSA9IGxlbiA9IHN0ci5sZW5ndGg7IGktLTspIHtcbiAgICB2YXIgY29kZSA9IHN0cltpXS5jaGFyQ29kZUF0KCk7XG4gICAgaWYgKDB4REMwMCA8PSBjb2RlICYmIGNvZGUgPD0gMHhERkZGKSBpLS07XG4gICAgaWYgKDB4N2YgPCBjb2RlICYmIGNvZGUgPD0gMHg3ZmYpIGxlbisrO1xuICAgIGVsc2UgaWYgKDB4N2ZmIDwgY29kZSAmJiBjb2RlIDw9IDB4ZmZmZikgbGVuICs9IDI7XG4gIH1cblxuICByZXR1cm4gbGVuO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vLyBEb24ndCBjaGVjayBidWZmZXIgdHlwZSBpbiBicm93c2VyLlxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdEJ1ZmZlcjogZnVuY3Rpb24gKCkge31cbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLy8gV2Ugd29uJ3QgYm90aGVyIGxvYWRpbmcgbWltZS10eXBlcyBpbiB0aGUgYnJvd3Nlci5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRsb29rdXA6IGZ1bmN0aW9uICgpIHt9XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBodG1sUmVnID0gL15cXHMqPC87XG52YXIgYnVmZmVyICA9IHJlcXVpcmUoXCJidWZmZXJcIikuQnVmZmVyO1xudmFyIGxvb2t1cCAgPSByZXF1aXJlKFwibWltZS10eXBlc1wiKS5sb29rdXA7XG5cbi8qKlxuICogRnVuY3Rpb24gdGhhdCBhdHRlbXB0cyB0byBndWVzcyB0aGUgY29udGVudCB0eXBlIGZvciBhIHZhbHVlLlxuICpcbiAqIFN1cHBvcnRzOlxuICogKiB0ZXh0L3BsYWluXG4gKiAqIHRleHQvaHRtbFxuICogKiBhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cbiAqICogYXBwbGljYXRpb24vanNvblxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNoZWNrQ29udGVudCAoZGF0YSkge1xuXHRpZiAoZGF0YSA9PSBudWxsIHx8IHR5cGVvZiBkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybjtcblxuXHRpZiAodHlwZW9mIGRhdGEgPT09IFwib2JqZWN0XCIpIHtcblx0XHRpZiAoaXNCdWZmZXIoZGF0YSkpIHtcblx0XHRcdHJldHVybiBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiO1xuXHRcdH0gZWxzZSBpZiAoaXNTdHJlYW0oZGF0YSkpIHtcblx0XHRcdHJldHVybiBsb29rdXAoZGF0YS5wYXRoKSB8fCBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiO1xuXHRcdH0gZWxzZSBpZiAoaXNKU09OKGRhdGEpKSB7XG5cdFx0XHRyZXR1cm4gXCJhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04XCI7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIFwidGV4dC9cIiArIChcblx0XHRodG1sUmVnLnRlc3QoU3RyaW5nKGRhdGEpKVxuXHRcdFx0PyBcImh0bWxcIlxuXHRcdFx0OiBcInBsYWluXCJcblx0KSArIFwiOyBjaGFyc2V0PVVURi04XCI7XG59O1xuXG4vKipcbiAqIFRlc3QgaWYgYSB2YWx1ZSBpcyBhIG5vZGUgYnVmZmVyLlxuICovXG5mdW5jdGlvbiBpc0J1ZmZlciAodmFsKSB7XG5cdHJldHVybiB2YWwgaW5zdGFuY2VvZiBidWZmZXI7XG59XG5cbi8qKlxuICogVGVzdCBpZiBhIHZhbHVlIGlzIGEgbm9kZSBzdHJlYW0uXG4gKi9cbmZ1bmN0aW9uIGlzU3RyZWFtICh2YWwpIHtcblx0cmV0dXJuIHR5cGVvZiB2YWwucGlwZSA9PT0gXCJmdW5jdGlvblwiO1xufVxuXG4vKipcbiAqIFRlc3QgaWYgYSB2YWx1ZSBjYW4gYmUganNvbi5cbiAqL1xuZnVuY3Rpb24gaXNKU09OICh2YWwpIHtcblx0Ly8gVHJ5IHRvIGNoZWNrIGlmIEpTT04gd2l0aG91dCBzdHJpbmdpZnkuXG5cdGlmIChcblx0XHR0eXBlb2YgdmFsLnRvSlNPTiA9PT0gXCJmdW5jdGlvblwiIHx8XG5cdFx0dmFsLmNvbnN0cnVjdG9yID09PSBPYmplY3QgfHxcblx0XHR2YWwuY29uc3RydWN0b3IgPT09IEFycmF5XG5cdCkgcmV0dXJuIHRydWU7XG5cblx0dHJ5IHtcblx0XHRKU09OLnN0cmluZ2lmeSh2YWwpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChfKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBmaWVsZDtcblxuLyoqXG4gKiBDb252ZXJ0cyBoeXBoZW5hdGVkIGhlYWRlcnMgbGlrZSBgQ29udGVudC1UeXBlYCBpbnRvIGBjb250ZW50LXR5cGVgLlxuICovXG5mdW5jdGlvbiBmaWVsZCAoc3RyKSB7XG5cdGlmICh0eXBlb2Ygc3RyICE9PSBcInN0cmluZ1wiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSGVhZGVyIEZpZWxkcyBtdXN0IGJlIHN0cmluZ3MuXCIpO1xuXHRzdHIgPSBzdHIudG9Mb3dlckNhc2UoKTtcblx0aWYgKHN0ciA9PT0gXCJyZWZlcnJlclwiKSBzdHIgPSBcInJlZmVyZXJcIjtcblx0cmV0dXJuIHN0cjtcbn07XG4iLCIndXNlIHN0cmljdCdcblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xudmFyIGJ1ZmZlciA9IGdsb2JhbC5CdWZmZXIgfHwgbm9vcFxudmFyIHR5cGVDbGFzcyA9IHtcbiAgc3RyaW5nOiAnW29iamVjdCBTdHJpbmddJyxcbiAgbnVtYmVyOiAnW29iamVjdCBOdW1iZXJdJyxcbiAgYm9vbGVhbjogJ1tvYmplY3QgQm9vbGVhbl0nLFxuICBkYXRlOiAnW29iamVjdCBEYXRlXScsXG4gIHJlZ2V4cDogJ1tvYmplY3QgUmVnRXhwXScsXG4gIGVycm9yOiAnW29iamVjdCBFcnJvcl0nLFxuICBmdW5jdGlvbjogJ1tvYmplY3QgRnVuY3Rpb25dJyxcbiAgYXJndW1lbnRzOiAnW29iamVjdCBBcmd1bWVudHNdJyxcbiAgb2JqZWN0OiAnW29iamVjdCBPYmplY3RdJyxcbiAgYXJyYXk6ICdbb2JqZWN0IEFycmF5XSdcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHN0cmluZzogaXNUeXBlKCdTdHJpbmcnKSxcbiAgbnVtYmVyOiBpc1R5cGUoJ051bWJlcicpLFxuICBib29sZWFuOiBpc1R5cGUoJ0Jvb2xlYW4nKSxcbiAgZGF0ZTogaXNUeXBlKCdEYXRlJyksXG4gIHJlZ2V4cDogaXNUeXBlKCdSZWdFeHAnKSxcbiAgZXJyb3I6IGlzVHlwZSgnRXJyb3InKSxcbiAgZnVuY3Rpb246IGlzVHlwZSgnRnVuY3Rpb24nKSxcbiAgYXJndW1lbnRzOiBpc1R5cGUoJ0FyZ3VtZW50cycpLFxuICBvYmplY3Q6IGlzVHlwZSgnT2JqZWN0JyksXG4gIGFycmF5OiBpc1R5cGUoJ0FycmF5JyksXG4gIHN0cmVhbTogZnVuY3Rpb24gaXNTdHJlYW0gKHZhbCkge1xuICAgIHJldHVybiB2YWwgIT0gbnVsbCAmJiB0eXBlb2YgdmFsLnBpcGUgPT09ICdmdW5jdGlvbidcbiAgfSxcbiAgYnVmZmVyOiBmdW5jdGlvbiBpc0J1ZmZlciAodmFsKSB7XG4gICAgcmV0dXJuIHZhbCBpbnN0YW5jZW9mIGJ1ZmZlclxuICB9LFxuICBlbXB0eTogZnVuY3Rpb24gaXNFbXB0eSAodmFsKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgKi9cbiAgICBmb3IgKHZhciBrZXkgaW4gdmFsKSByZXR1cm4gZmFsc2VcbiAgICAvKiBlc2xpbnQtZW5hYmxlICovXG4gICAgcmV0dXJuIHRydWVcbiAgfVxufVxuXG4vKipcbiAqIERvZXMgbm90aGluZy5cbiAqL1xuZnVuY3Rpb24gbm9vcCAoKSB7fVxuXG4vKlxuICogQ3JlYXRlcyBhIHR5cGUgY2hlY2tlciBmdW5jdGlvbiBiYXNlZCBvbiB0aGUgZ2l2ZW4gdHlwZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGlzVHlwZSAobmFtZSkge1xuICB2YXIgdHlwZSA9IG5hbWUudG9Mb3dlckNhc2UoKVxuICByZXR1cm4gZnVuY3Rpb24gKHZhbCkge1xuICAgIHZhciBfdHlwZW9mID0gdHlwZW9mIHZhbFxuICAgIHN3aXRjaCAoX3R5cGVvZikge1xuICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gdHlwZUNsYXNzW3R5cGVdXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gX3R5cGVvZiA9PT0gdHlwZVxuICAgIH1cbiAgfVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBxc2V0ICAgICAgPSByZXF1aXJlKFwicS1zZXRcIik7XG52YXIgZnNldCAgICAgID0gcXNldC5mbGF0O1xudmFyIHRlbXAgICAgICA9IFtdO1xudmFyIHZhbGlkVGFncyA9IHtcblx0SU5QVVQ6IHRydWUsXG5cdFRFWFRBUkVBOiB0cnVlLFxuXHRTRUxFQ1Q6IHRydWUsXG5cdEJVVFRPTjogdHJ1ZVxufTtcblxuLypcbiAqIFNlcmlhbGl6ZSBhIGh0bWwgZm9ybSBhcyBKUyBvYmplY3QuXG4gKlxuICogQHBhcmFtIHs8Rm9ybS8+fSBmb3JtXG4gKiBAcmV0dXJucyB7IEFycmF5PEFycmF5PiB9XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gRm9ybUpTT04gKGZvcm0sIGZsYXQpIHtcblx0aWYgKCFmb3JtIHx8IGZvcm0ubm9kZU5hbWUgIT09IFwiRk9STVwiKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FuIG9ubHkgcGFyc2UgZm9ybSBlbGVtZW50cy5cIik7XG5cdH1cblxuXHR2YXIgc2V0ICAgICAgICAgPSBmbGF0ID8gZnNldCA6IHFzZXQ7XG5cdHZhciBpc011bHRpUGFydCA9IGZvcm0uZW5jdHlwZSA9PT0gXCJtdWx0aXBhcnQvZm9ybS1kYXRhXCI7XG5cdHZhciBlbGVtZW50cyAgICA9IGZvcm0uZWxlbWVudHM7XG5cdHZhciBib2R5ICAgICAgICA9IHt9O1xuXHR2YXIgZmlsZXMgICAgICAgPSBpc011bHRpUGFydCA/IHt9IDogdW5kZWZpbmVkO1xuXHR2YXIgZWxlbWVudDtcblxuXHRmb3IgKHZhciBpID0gMCwgbGVuID0gZWxlbWVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRlbGVtZW50ID0gZWxlbWVudHNbaV07XG5cblx0XHQvLyBDaGVjayBpZiB0aGlzIGVsZW1lbnQgc2hvdWxkIGJlIHNlcmlhbGl6ZWQuXG5cdFx0aWYgKGVsZW1lbnQuZGlzYWJsZWQgfHwgIShlbGVtZW50Lm5hbWUgJiYgdmFsaWRUYWdzW2VsZW1lbnQubm9kZU5hbWVdKSkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0dmFyIG5hbWUgICAgPSBlbGVtZW50Lm5hbWU7XG5cdFx0dmFyIG9wdGlvbnMgPSBlbGVtZW50Lm9wdGlvbnM7XG5cblx0XHRzd2l0Y2ggKGVsZW1lbnQudHlwZSkge1xuXHRcdFx0Y2FzZSBcInN1Ym1pdFwiOlxuXHRcdFx0XHQvLyBXZSBjaGVjayBpZiB0aGUgc3VibWl0IGJ1dHRvbiBpcyBhY3RpdmVcblx0XHRcdFx0Ly8gb3RoZXJ3aXNlIGFsbCB0eXBlPXN1Ym1pdCBidXR0b25zIHdvdWxkIGJlIHNlcmlhbGl6ZWQuXG5cdFx0XHRcdGlmIChlbGVtZW50ID09PSBkb2N1bWVudC5hY3RpdmVFbGVtZW50KSBzZXQoYm9keSwgbmFtZSwgZWxlbWVudC52YWx1ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcImNoZWNrYm94XCI6XG5cdFx0XHRjYXNlIFwicmFkaW9cIjpcblx0XHRcdFx0aWYgKGVsZW1lbnQuY2hlY2tlZCkgc2V0KGJvZHksIG5hbWUsIGVsZW1lbnQudmFsdWUpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgXCJzZWxlY3Qtb25lXCI6XG5cdFx0XHRcdGlmIChlbGVtZW50LnNlbGVjdGVkSW5kZXggPj0gMCkgc2V0KGJvZHksIG5hbWUsIG9wdGlvbnNbZWxlbWVudC5zZWxlY3RlZEluZGV4XS52YWx1ZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcInNlbGVjdC1tdWx0aXBsZVwiOlxuXHRcdFx0XHR2YXIgc2VsZWN0ZWQgPSBbXTtcblx0XHRcdFx0dmFyIG9wdGlvbjtcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDAsIF9sZW4gPSBvcHRpb25zLmxlbmd0aDsgaiA8IF9sZW47IGorKykge1xuXHRcdFx0XHRcdG9wdGlvbiA9IG9wdGlvbnNbal07XG5cdFx0XHRcdFx0aWYgKG9wdGlvbiAmJiBvcHRpb24uc2VsZWN0ZWQpIHNlbGVjdGVkLnB1c2gob3B0aW9uLnZhbHVlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNldChib2R5LCBuYW1lLCBzZWxlY3RlZCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcImZpbGVcIjpcblx0XHRcdFx0dmFyIGZpbGVMaXN0ID0gZWxlbWVudC5maWxlcztcblx0XHRcdFx0aWYgKGlzTXVsdGlQYXJ0ICYmIGZpbGVMaXN0KSB7XG5cdFx0XHRcdFx0Zm9yICh2YXIgX2kgPSAwLCBfbGVuID0gZmlsZUxpc3QubGVuZ3RoOyBfaSA8IF9sZW47IF9pKyspIHtcblx0XHRcdFx0XHRcdHNldChmaWxlcywgbmFtZSwgZmlsZUxpc3RbX2ldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRzZXQoYm9keSwgbmFtZSwgZWxlbWVudC52YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRib2R5OiBib2R5LFxuXHRcdGZpbGVzOiBmaWxlc1xuXHR9O1xufTtcbiIsInZhciBpc2FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbi8qKlxuICogRXhwb3NlIGBwYXRoVG9SZWdleHBgLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGhUb1JlZ2V4cFxubW9kdWxlLmV4cG9ydHMucGFyc2UgPSBwYXJzZVxubW9kdWxlLmV4cG9ydHMuY29tcGlsZSA9IGNvbXBpbGVcbm1vZHVsZS5leHBvcnRzLnRva2Vuc1RvRnVuY3Rpb24gPSB0b2tlbnNUb0Z1bmN0aW9uXG5tb2R1bGUuZXhwb3J0cy50b2tlbnNUb1JlZ0V4cCA9IHRva2Vuc1RvUmVnRXhwXG5cbi8qKlxuICogVGhlIG1haW4gcGF0aCBtYXRjaGluZyByZWdleHAgdXRpbGl0eS5cbiAqXG4gKiBAdHlwZSB7UmVnRXhwfVxuICovXG52YXIgUEFUSF9SRUdFWFAgPSBuZXcgUmVnRXhwKFtcbiAgLy8gTWF0Y2ggZXNjYXBlZCBjaGFyYWN0ZXJzIHRoYXQgd291bGQgb3RoZXJ3aXNlIGFwcGVhciBpbiBmdXR1cmUgbWF0Y2hlcy5cbiAgLy8gVGhpcyBhbGxvd3MgdGhlIHVzZXIgdG8gZXNjYXBlIHNwZWNpYWwgY2hhcmFjdGVycyB0aGF0IHdvbid0IHRyYW5zZm9ybS5cbiAgJyhcXFxcXFxcXC4pJyxcbiAgLy8gTWF0Y2ggRXhwcmVzcy1zdHlsZSBwYXJhbWV0ZXJzIGFuZCB1bi1uYW1lZCBwYXJhbWV0ZXJzIHdpdGggYSBwcmVmaXhcbiAgLy8gYW5kIG9wdGlvbmFsIHN1ZmZpeGVzLiBNYXRjaGVzIGFwcGVhciBhczpcbiAgLy9cbiAgLy8gXCIvOnRlc3QoXFxcXGQrKT9cIiA9PiBbXCIvXCIsIFwidGVzdFwiLCBcIlxcZCtcIiwgdW5kZWZpbmVkLCBcIj9cIiwgdW5kZWZpbmVkXVxuICAvLyBcIi9yb3V0ZShcXFxcZCspXCIgID0+IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBcIlxcZCtcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWRdXG4gIC8vIFwiLypcIiAgICAgICAgICAgID0+IFtcIi9cIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBcIipcIl1cbiAgJyhbXFxcXC8uXSk/KD86KD86XFxcXDooXFxcXHcrKSg/OlxcXFwoKCg/OlxcXFxcXFxcLnxbXlxcXFxcXFxcKCldKSspXFxcXCkpP3xcXFxcKCgoPzpcXFxcXFxcXC58W15cXFxcXFxcXCgpXSkrKVxcXFwpKShbKyo/XSk/fChcXFxcKikpJ1xuXS5qb2luKCd8JyksICdnJylcblxuLyoqXG4gKiBQYXJzZSBhIHN0cmluZyBmb3IgdGhlIHJhdyB0b2tlbnMuXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSAgc3RyXG4gKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zXG4gKiBAcmV0dXJuIHshQXJyYXl9XG4gKi9cbmZ1bmN0aW9uIHBhcnNlIChzdHIsIG9wdGlvbnMpIHtcbiAgdmFyIHRva2VucyA9IFtdXG4gIHZhciBrZXkgPSAwXG4gIHZhciBpbmRleCA9IDBcbiAgdmFyIHBhdGggPSAnJ1xuICB2YXIgZGVmYXVsdERlbGltaXRlciA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJy8nXG4gIHZhciByZXNcblxuICB3aGlsZSAoKHJlcyA9IFBBVEhfUkVHRVhQLmV4ZWMoc3RyKSkgIT0gbnVsbCkge1xuICAgIHZhciBtID0gcmVzWzBdXG4gICAgdmFyIGVzY2FwZWQgPSByZXNbMV1cbiAgICB2YXIgb2Zmc2V0ID0gcmVzLmluZGV4XG4gICAgcGF0aCArPSBzdHIuc2xpY2UoaW5kZXgsIG9mZnNldClcbiAgICBpbmRleCA9IG9mZnNldCArIG0ubGVuZ3RoXG5cbiAgICAvLyBJZ25vcmUgYWxyZWFkeSBlc2NhcGVkIHNlcXVlbmNlcy5cbiAgICBpZiAoZXNjYXBlZCkge1xuICAgICAgcGF0aCArPSBlc2NhcGVkWzFdXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIHZhciBuZXh0ID0gc3RyW2luZGV4XVxuICAgIHZhciBwcmVmaXggPSByZXNbMl1cbiAgICB2YXIgbmFtZSA9IHJlc1szXVxuICAgIHZhciBjYXB0dXJlID0gcmVzWzRdXG4gICAgdmFyIGdyb3VwID0gcmVzWzVdXG4gICAgdmFyIG1vZGlmaWVyID0gcmVzWzZdXG4gICAgdmFyIGFzdGVyaXNrID0gcmVzWzddXG5cbiAgICAvLyBQdXNoIHRoZSBjdXJyZW50IHBhdGggb250byB0aGUgdG9rZW5zLlxuICAgIGlmIChwYXRoKSB7XG4gICAgICB0b2tlbnMucHVzaChwYXRoKVxuICAgICAgcGF0aCA9ICcnXG4gICAgfVxuXG4gICAgdmFyIHBhcnRpYWwgPSBwcmVmaXggIT0gbnVsbCAmJiBuZXh0ICE9IG51bGwgJiYgbmV4dCAhPT0gcHJlZml4XG4gICAgdmFyIHJlcGVhdCA9IG1vZGlmaWVyID09PSAnKycgfHwgbW9kaWZpZXIgPT09ICcqJ1xuICAgIHZhciBvcHRpb25hbCA9IG1vZGlmaWVyID09PSAnPycgfHwgbW9kaWZpZXIgPT09ICcqJ1xuICAgIHZhciBkZWxpbWl0ZXIgPSByZXNbMl0gfHwgZGVmYXVsdERlbGltaXRlclxuICAgIHZhciBwYXR0ZXJuID0gY2FwdHVyZSB8fCBncm91cFxuXG4gICAgdG9rZW5zLnB1c2goe1xuICAgICAgbmFtZTogbmFtZSB8fCBrZXkrKyxcbiAgICAgIHByZWZpeDogcHJlZml4IHx8ICcnLFxuICAgICAgZGVsaW1pdGVyOiBkZWxpbWl0ZXIsXG4gICAgICBvcHRpb25hbDogb3B0aW9uYWwsXG4gICAgICByZXBlYXQ6IHJlcGVhdCxcbiAgICAgIHBhcnRpYWw6IHBhcnRpYWwsXG4gICAgICBhc3RlcmlzazogISFhc3RlcmlzayxcbiAgICAgIHBhdHRlcm46IHBhdHRlcm4gPyBlc2NhcGVHcm91cChwYXR0ZXJuKSA6IChhc3RlcmlzayA/ICcuKicgOiAnW14nICsgZXNjYXBlU3RyaW5nKGRlbGltaXRlcikgKyAnXSs/JylcbiAgICB9KVxuICB9XG5cbiAgLy8gTWF0Y2ggYW55IGNoYXJhY3RlcnMgc3RpbGwgcmVtYWluaW5nLlxuICBpZiAoaW5kZXggPCBzdHIubGVuZ3RoKSB7XG4gICAgcGF0aCArPSBzdHIuc3Vic3RyKGluZGV4KVxuICB9XG5cbiAgLy8gSWYgdGhlIHBhdGggZXhpc3RzLCBwdXNoIGl0IG9udG8gdGhlIGVuZC5cbiAgaWYgKHBhdGgpIHtcbiAgICB0b2tlbnMucHVzaChwYXRoKVxuICB9XG5cbiAgcmV0dXJuIHRva2Vuc1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBzdHJpbmcgdG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiBmb3IgdGhlIHBhdGguXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSAgICAgICAgICAgICBzdHJcbiAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICAgICAgb3B0aW9uc1xuICogQHJldHVybiB7IWZ1bmN0aW9uKE9iamVjdD0sIE9iamVjdD0pfVxuICovXG5mdW5jdGlvbiBjb21waWxlIChzdHIsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIHRva2Vuc1RvRnVuY3Rpb24ocGFyc2Uoc3RyLCBvcHRpb25zKSlcbn1cblxuLyoqXG4gKiBQcmV0dGllciBlbmNvZGluZyBvZiBVUkkgcGF0aCBzZWdtZW50cy5cbiAqXG4gKiBAcGFyYW0gIHtzdHJpbmd9XG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGVuY29kZVVSSUNvbXBvbmVudFByZXR0eSAoc3RyKSB7XG4gIHJldHVybiBlbmNvZGVVUkkoc3RyKS5yZXBsYWNlKC9bXFwvPyNdL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgcmV0dXJuICclJyArIGMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKVxuICB9KVxufVxuXG4vKipcbiAqIEVuY29kZSB0aGUgYXN0ZXJpc2sgcGFyYW1ldGVyLiBTaW1pbGFyIHRvIGBwcmV0dHlgLCBidXQgYWxsb3dzIHNsYXNoZXMuXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfVxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiBlbmNvZGVBc3RlcmlzayAoc3RyKSB7XG4gIHJldHVybiBlbmNvZGVVUkkoc3RyKS5yZXBsYWNlKC9bPyNdL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgcmV0dXJuICclJyArIGMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKVxuICB9KVxufVxuXG4vKipcbiAqIEV4cG9zZSBhIG1ldGhvZCBmb3IgdHJhbnNmb3JtaW5nIHRva2VucyBpbnRvIHRoZSBwYXRoIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiB0b2tlbnNUb0Z1bmN0aW9uICh0b2tlbnMpIHtcbiAgLy8gQ29tcGlsZSBhbGwgdGhlIHRva2VucyBpbnRvIHJlZ2V4cHMuXG4gIHZhciBtYXRjaGVzID0gbmV3IEFycmF5KHRva2Vucy5sZW5ndGgpXG5cbiAgLy8gQ29tcGlsZSBhbGwgdGhlIHBhdHRlcm5zIGJlZm9yZSBjb21waWxhdGlvbi5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodHlwZW9mIHRva2Vuc1tpXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG1hdGNoZXNbaV0gPSBuZXcgUmVnRXhwKCdeKD86JyArIHRva2Vuc1tpXS5wYXR0ZXJuICsgJykkJylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24gKG9iaiwgb3B0cykge1xuICAgIHZhciBwYXRoID0gJydcbiAgICB2YXIgZGF0YSA9IG9iaiB8fCB7fVxuICAgIHZhciBvcHRpb25zID0gb3B0cyB8fCB7fVxuICAgIHZhciBlbmNvZGUgPSBvcHRpb25zLnByZXR0eSA/IGVuY29kZVVSSUNvbXBvbmVudFByZXR0eSA6IGVuY29kZVVSSUNvbXBvbmVudFxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0b2tlbiA9IHRva2Vuc1tpXVxuXG4gICAgICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgICBwYXRoICs9IHRva2VuXG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgdmFyIHZhbHVlID0gZGF0YVt0b2tlbi5uYW1lXVxuICAgICAgdmFyIHNlZ21lbnRcblxuICAgICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgaWYgKHRva2VuLm9wdGlvbmFsKSB7XG4gICAgICAgICAgLy8gUHJlcGVuZCBwYXJ0aWFsIHNlZ21lbnQgcHJlZml4ZXMuXG4gICAgICAgICAgaWYgKHRva2VuLnBhcnRpYWwpIHtcbiAgICAgICAgICAgIHBhdGggKz0gdG9rZW4ucHJlZml4XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBcIicgKyB0b2tlbi5uYW1lICsgJ1wiIHRvIGJlIGRlZmluZWQnKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChpc2FycmF5KHZhbHVlKSkge1xuICAgICAgICBpZiAoIXRva2VuLnJlcGVhdCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIFwiJyArIHRva2VuLm5hbWUgKyAnXCIgdG8gbm90IHJlcGVhdCwgYnV0IHJlY2VpdmVkIGAnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpICsgJ2AnKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGlmICh0b2tlbi5vcHRpb25hbCkge1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgXCInICsgdG9rZW4ubmFtZSArICdcIiB0byBub3QgYmUgZW1wdHknKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsdWUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBzZWdtZW50ID0gZW5jb2RlKHZhbHVlW2pdKVxuXG4gICAgICAgICAgaWYgKCFtYXRjaGVzW2ldLnRlc3Qoc2VnbWVudCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGFsbCBcIicgKyB0b2tlbi5uYW1lICsgJ1wiIHRvIG1hdGNoIFwiJyArIHRva2VuLnBhdHRlcm4gKyAnXCIsIGJ1dCByZWNlaXZlZCBgJyArIEpTT04uc3RyaW5naWZ5KHNlZ21lbnQpICsgJ2AnKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHBhdGggKz0gKGogPT09IDAgPyB0b2tlbi5wcmVmaXggOiB0b2tlbi5kZWxpbWl0ZXIpICsgc2VnbWVudFxuICAgICAgICB9XG5cbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgc2VnbWVudCA9IHRva2VuLmFzdGVyaXNrID8gZW5jb2RlQXN0ZXJpc2sodmFsdWUpIDogZW5jb2RlKHZhbHVlKVxuXG4gICAgICBpZiAoIW1hdGNoZXNbaV0udGVzdChzZWdtZW50KSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBcIicgKyB0b2tlbi5uYW1lICsgJ1wiIHRvIG1hdGNoIFwiJyArIHRva2VuLnBhdHRlcm4gKyAnXCIsIGJ1dCByZWNlaXZlZCBcIicgKyBzZWdtZW50ICsgJ1wiJylcbiAgICAgIH1cblxuICAgICAgcGF0aCArPSB0b2tlbi5wcmVmaXggKyBzZWdtZW50XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhdGhcbiAgfVxufVxuXG4vKipcbiAqIEVzY2FwZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBzdHJpbmcuXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gZXNjYXBlU3RyaW5nIChzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC8oWy4rKj89XiE6JHt9KClbXFxdfFxcL1xcXFxdKS9nLCAnXFxcXCQxJylcbn1cblxuLyoqXG4gKiBFc2NhcGUgdGhlIGNhcHR1cmluZyBncm91cCBieSBlc2NhcGluZyBzcGVjaWFsIGNoYXJhY3RlcnMgYW5kIG1lYW5pbmcuXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSBncm91cFxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5mdW5jdGlvbiBlc2NhcGVHcm91cCAoZ3JvdXApIHtcbiAgcmV0dXJuIGdyb3VwLnJlcGxhY2UoLyhbPSE6JFxcLygpXSkvZywgJ1xcXFwkMScpXG59XG5cbi8qKlxuICogQXR0YWNoIHRoZSBrZXlzIGFzIGEgcHJvcGVydHkgb2YgdGhlIHJlZ2V4cC5cbiAqXG4gKiBAcGFyYW0gIHshUmVnRXhwfSByZVxuICogQHBhcmFtICB7QXJyYXl9ICAga2V5c1xuICogQHJldHVybiB7IVJlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gYXR0YWNoS2V5cyAocmUsIGtleXMpIHtcbiAgcmUua2V5cyA9IGtleXNcbiAgcmV0dXJuIHJlXG59XG5cbi8qKlxuICogR2V0IHRoZSBmbGFncyBmb3IgYSByZWdleHAgZnJvbSB0aGUgb3B0aW9ucy5cbiAqXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZnVuY3Rpb24gZmxhZ3MgKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG9wdGlvbnMuc2Vuc2l0aXZlID8gJycgOiAnaSdcbn1cblxuLyoqXG4gKiBQdWxsIG91dCBrZXlzIGZyb20gYSByZWdleHAuXG4gKlxuICogQHBhcmFtICB7IVJlZ0V4cH0gcGF0aFxuICogQHBhcmFtICB7IUFycmF5fSAga2V5c1xuICogQHJldHVybiB7IVJlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gcmVnZXhwVG9SZWdleHAgKHBhdGgsIGtleXMpIHtcbiAgLy8gVXNlIGEgbmVnYXRpdmUgbG9va2FoZWFkIHRvIG1hdGNoIG9ubHkgY2FwdHVyaW5nIGdyb3Vwcy5cbiAgdmFyIGdyb3VwcyA9IHBhdGguc291cmNlLm1hdGNoKC9cXCgoPyFcXD8pL2cpXG5cbiAgaWYgKGdyb3Vwcykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZ3JvdXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBrZXlzLnB1c2goe1xuICAgICAgICBuYW1lOiBpLFxuICAgICAgICBwcmVmaXg6IG51bGwsXG4gICAgICAgIGRlbGltaXRlcjogbnVsbCxcbiAgICAgICAgb3B0aW9uYWw6IGZhbHNlLFxuICAgICAgICByZXBlYXQ6IGZhbHNlLFxuICAgICAgICBwYXJ0aWFsOiBmYWxzZSxcbiAgICAgICAgYXN0ZXJpc2s6IGZhbHNlLFxuICAgICAgICBwYXR0ZXJuOiBudWxsXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhdHRhY2hLZXlzKHBhdGgsIGtleXMpXG59XG5cbi8qKlxuICogVHJhbnNmb3JtIGFuIGFycmF5IGludG8gYSByZWdleHAuXG4gKlxuICogQHBhcmFtICB7IUFycmF5fSAgcGF0aFxuICogQHBhcmFtICB7QXJyYXl9ICAga2V5c1xuICogQHBhcmFtICB7IU9iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7IVJlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gYXJyYXlUb1JlZ2V4cCAocGF0aCwga2V5cywgb3B0aW9ucykge1xuICB2YXIgcGFydHMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcGF0aC5sZW5ndGg7IGkrKykge1xuICAgIHBhcnRzLnB1c2gocGF0aFRvUmVnZXhwKHBhdGhbaV0sIGtleXMsIG9wdGlvbnMpLnNvdXJjZSlcbiAgfVxuXG4gIHZhciByZWdleHAgPSBuZXcgUmVnRXhwKCcoPzonICsgcGFydHMuam9pbignfCcpICsgJyknLCBmbGFncyhvcHRpb25zKSlcblxuICByZXR1cm4gYXR0YWNoS2V5cyhyZWdleHAsIGtleXMpXG59XG5cbi8qKlxuICogQ3JlYXRlIGEgcGF0aCByZWdleHAgZnJvbSBzdHJpbmcgaW5wdXQuXG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSAgcGF0aFxuICogQHBhcmFtICB7IUFycmF5fSAga2V5c1xuICogQHBhcmFtICB7IU9iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7IVJlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gc3RyaW5nVG9SZWdleHAgKHBhdGgsIGtleXMsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIHRva2Vuc1RvUmVnRXhwKHBhcnNlKHBhdGgsIG9wdGlvbnMpLCBrZXlzLCBvcHRpb25zKVxufVxuXG4vKipcbiAqIEV4cG9zZSBhIGZ1bmN0aW9uIGZvciB0YWtpbmcgdG9rZW5zIGFuZCByZXR1cm5pbmcgYSBSZWdFeHAuXG4gKlxuICogQHBhcmFtICB7IUFycmF5fSAgICAgICAgICB0b2tlbnNcbiAqIEBwYXJhbSAgeyhBcnJheXxPYmplY3QpPX0ga2V5c1xuICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgICBvcHRpb25zXG4gKiBAcmV0dXJuIHshUmVnRXhwfVxuICovXG5mdW5jdGlvbiB0b2tlbnNUb1JlZ0V4cCAodG9rZW5zLCBrZXlzLCBvcHRpb25zKSB7XG4gIGlmICghaXNhcnJheShrZXlzKSkge1xuICAgIG9wdGlvbnMgPSAvKiogQHR5cGUgeyFPYmplY3R9ICovIChrZXlzIHx8IG9wdGlvbnMpXG4gICAga2V5cyA9IFtdXG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXG4gIHZhciBzdHJpY3QgPSBvcHRpb25zLnN0cmljdFxuICB2YXIgZW5kID0gb3B0aW9ucy5lbmQgIT09IGZhbHNlXG4gIHZhciByb3V0ZSA9ICcnXG4gIHZhciBsYXN0VG9rZW4gPSB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdXG4gIHZhciBlbmRzV2l0aFNsYXNoID0gdHlwZW9mIGxhc3RUb2tlbiA9PT0gJ3N0cmluZycgJiYgL1xcLyQvLnRlc3QobGFzdFRva2VuKVxuXG4gIC8vIEl0ZXJhdGUgb3ZlciB0aGUgdG9rZW5zIGFuZCBjcmVhdGUgb3VyIHJlZ2V4cCBzdHJpbmcuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHRva2VuID0gdG9rZW5zW2ldXG5cbiAgICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgcm91dGUgKz0gZXNjYXBlU3RyaW5nKHRva2VuKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcHJlZml4ID0gZXNjYXBlU3RyaW5nKHRva2VuLnByZWZpeClcbiAgICAgIHZhciBjYXB0dXJlID0gJyg/OicgKyB0b2tlbi5wYXR0ZXJuICsgJyknXG5cbiAgICAgIGtleXMucHVzaCh0b2tlbilcblxuICAgICAgaWYgKHRva2VuLnJlcGVhdCkge1xuICAgICAgICBjYXB0dXJlICs9ICcoPzonICsgcHJlZml4ICsgY2FwdHVyZSArICcpKidcbiAgICAgIH1cblxuICAgICAgaWYgKHRva2VuLm9wdGlvbmFsKSB7XG4gICAgICAgIGlmICghdG9rZW4ucGFydGlhbCkge1xuICAgICAgICAgIGNhcHR1cmUgPSAnKD86JyArIHByZWZpeCArICcoJyArIGNhcHR1cmUgKyAnKSk/J1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhcHR1cmUgPSBwcmVmaXggKyAnKCcgKyBjYXB0dXJlICsgJyk/J1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYXB0dXJlID0gcHJlZml4ICsgJygnICsgY2FwdHVyZSArICcpJ1xuICAgICAgfVxuXG4gICAgICByb3V0ZSArPSBjYXB0dXJlXG4gICAgfVxuICB9XG5cbiAgLy8gSW4gbm9uLXN0cmljdCBtb2RlIHdlIGFsbG93IGEgc2xhc2ggYXQgdGhlIGVuZCBvZiBtYXRjaC4gSWYgdGhlIHBhdGggdG9cbiAgLy8gbWF0Y2ggYWxyZWFkeSBlbmRzIHdpdGggYSBzbGFzaCwgd2UgcmVtb3ZlIGl0IGZvciBjb25zaXN0ZW5jeS4gVGhlIHNsYXNoXG4gIC8vIGlzIHZhbGlkIGF0IHRoZSBlbmQgb2YgYSBwYXRoIG1hdGNoLCBub3QgaW4gdGhlIG1pZGRsZS4gVGhpcyBpcyBpbXBvcnRhbnRcbiAgLy8gaW4gbm9uLWVuZGluZyBtb2RlLCB3aGVyZSBcIi90ZXN0L1wiIHNob3VsZG4ndCBtYXRjaCBcIi90ZXN0Ly9yb3V0ZVwiLlxuICBpZiAoIXN0cmljdCkge1xuICAgIHJvdXRlID0gKGVuZHNXaXRoU2xhc2ggPyByb3V0ZS5zbGljZSgwLCAtMikgOiByb3V0ZSkgKyAnKD86XFxcXC8oPz0kKSk/J1xuICB9XG5cbiAgaWYgKGVuZCkge1xuICAgIHJvdXRlICs9ICckJ1xuICB9IGVsc2Uge1xuICAgIC8vIEluIG5vbi1lbmRpbmcgbW9kZSwgd2UgbmVlZCB0aGUgY2FwdHVyaW5nIGdyb3VwcyB0byBtYXRjaCBhcyBtdWNoIGFzXG4gICAgLy8gcG9zc2libGUgYnkgdXNpbmcgYSBwb3NpdGl2ZSBsb29rYWhlYWQgdG8gdGhlIGVuZCBvciBuZXh0IHBhdGggc2VnbWVudC5cbiAgICByb3V0ZSArPSBzdHJpY3QgJiYgZW5kc1dpdGhTbGFzaCA/ICcnIDogJyg/PVxcXFwvfCQpJ1xuICB9XG5cbiAgcmV0dXJuIGF0dGFjaEtleXMobmV3IFJlZ0V4cCgnXicgKyByb3V0ZSwgZmxhZ3Mob3B0aW9ucykpLCBrZXlzKVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgZ2l2ZW4gcGF0aCBzdHJpbmcsIHJldHVybmluZyBhIHJlZ3VsYXIgZXhwcmVzc2lvbi5cbiAqXG4gKiBBbiBlbXB0eSBhcnJheSBjYW4gYmUgcGFzc2VkIGluIGZvciB0aGUga2V5cywgd2hpY2ggd2lsbCBob2xkIHRoZVxuICogcGxhY2Vob2xkZXIga2V5IGRlc2NyaXB0aW9ucy4gRm9yIGV4YW1wbGUsIHVzaW5nIGAvdXNlci86aWRgLCBga2V5c2Agd2lsbFxuICogY29udGFpbiBgW3sgbmFtZTogJ2lkJywgZGVsaW1pdGVyOiAnLycsIG9wdGlvbmFsOiBmYWxzZSwgcmVwZWF0OiBmYWxzZSB9XWAuXG4gKlxuICogQHBhcmFtICB7KHN0cmluZ3xSZWdFeHB8QXJyYXkpfSBwYXRoXG4gKiBAcGFyYW0gIHsoQXJyYXl8T2JqZWN0KT19ICAgICAgIGtleXNcbiAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICAgICAgICAgb3B0aW9uc1xuICogQHJldHVybiB7IVJlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gcGF0aFRvUmVnZXhwIChwYXRoLCBrZXlzLCBvcHRpb25zKSB7XG4gIGlmICghaXNhcnJheShrZXlzKSkge1xuICAgIG9wdGlvbnMgPSAvKiogQHR5cGUgeyFPYmplY3R9ICovIChrZXlzIHx8IG9wdGlvbnMpXG4gICAga2V5cyA9IFtdXG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXG4gIGlmIChwYXRoIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgcmV0dXJuIHJlZ2V4cFRvUmVnZXhwKHBhdGgsIC8qKiBAdHlwZSB7IUFycmF5fSAqLyAoa2V5cykpXG4gIH1cblxuICBpZiAoaXNhcnJheShwYXRoKSkge1xuICAgIHJldHVybiBhcnJheVRvUmVnZXhwKC8qKiBAdHlwZSB7IUFycmF5fSAqLyAocGF0aCksIC8qKiBAdHlwZSB7IUFycmF5fSAqLyAoa2V5cyksIG9wdGlvbnMpXG4gIH1cblxuICByZXR1cm4gc3RyaW5nVG9SZWdleHAoLyoqIEB0eXBlIHtzdHJpbmd9ICovIChwYXRoKSwgLyoqIEB0eXBlIHshQXJyYXl9ICovIChrZXlzKSwgb3B0aW9ucylcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgbWF0Y2hBcnJheSAgID0gL1teXFxbXFxdXSt8XFxbXFxdL2c7XG52YXIgbWF0Y2hJbnRlZ2VyID0gL15cXGQrJC87XG52YXIgdGVtcCAgICAgICAgID0gW107XG5cbi8qXG4gKiBAZGVzY3JpcHRpb25cbiAqIEEgc2V0dGVyIGZvciBxdWVyeXN0cmluZyBzdHlsZSBmaWVsZHMgbGlrZSBcImFbYl1bY11cIi5cbiAqIFRoZSBzZXR0ZXIgd2lsbCBjcmVhdGUgYXJyYXlzIGZvciByZXBlYXQga2V5cy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuZnVuY3Rpb24gcVNldCAob2JqLCBwYXRoLCB2YWwpIHtcblx0dmFyIGtleXMgPSBwYXRoID09PSBcIlwiID8gW1wiXCJdIDogcGF0aC5tYXRjaChtYXRjaEFycmF5KTtcblx0dmFyIGxlbiAgPSBrZXlzLmxlbmd0aDtcblx0dmFyIGN1ciAgPSBvYmo7XG5cdHZhciBrZXksIHByZXYsIG5leHQsIGV4aXN0O1xuXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcblx0XHRwcmV2ID0gY3VyO1xuXHRcdGtleSAgPSBrZXlzW2ldO1xuXHRcdG5leHQgPSBrZXlzW2kgKyAxXTtcblx0XHRpZiAoa2V5ID09PSBcIltdXCIpIGtleSA9IGN1ci5sZW5ndGg7XG5cdFx0Ly8gTWFrZSBwYXRoIGFzIHdlIGdvLlxuXHRcdGN1ciA9IChleGlzdCA9IHR5cGVvZiBjdXIgPT09IFwib2JqZWN0XCIgJiYga2V5IGluIGN1cilcblx0XHRcdD8gY3VyW2tleV1cblx0XHRcdC8vIENoZWNrIGlmIHRoZSBuZXh0IHBhdGggaXMgYW4gZXhwbGljaXQgYXJyYXkuXG5cdFx0XHQ6IGN1cltrZXldID0gKG5leHQgPT09IFwiW11cIiB8fCBtYXRjaEludGVnZXIudGVzdChuZXh0KSlcblx0XHRcdFx0PyBbXVxuXHRcdFx0XHQ6IHt9O1xuXHR9XG5cblx0cHJldltrZXldID0gZXhpc3QgPyB0ZW1wLmNvbmNhdChjdXIsIHZhbCkgOiB2YWw7XG5cblx0cmV0dXJuIG9iajtcbn07XG5cbi8qKlxuICogTGlrZSBxc2V0IGJ1dCBkb2Vzbid0IHJlc29sdmUgbmVzdGVkIHBhcmFtcyBzdWNoIGFzIGFbYl1bY10uXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuZnVuY3Rpb24gZlNldCAob2JqLCBrZXksIHZhbCkge1xuXHRrZXkgPSBhcnJheVB1c2hJbmRleGVzKG9iaiwga2V5KTtcblx0b2JqW2tleV0gPSBrZXkgaW4gb2JqXG5cdFx0PyB0ZW1wLmNvbmNhdChvYmpba2V5XSwgdmFsKVxuXHRcdDogdmFsO1xuXHRyZXR1cm4gb2JqO1xufVxuXG4vKipcbiAqIEdpdmVuIGEgcXMgc3R5bGUga2V5IGFuZCBhbiBvYmplY3Qgd2lsbCBjb252ZXJ0IGFycmF5IHB1c2ggc3ludGF4IHRvIGludGVnZXJzLlxuICogRWc6IGFbYl1bXSAtPiBhW2JdWzBdXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5mdW5jdGlvbiBhcnJheVB1c2hJbmRleGVzIChvYmosIGtleSkge1xuXHR2YXIgcGF0aCA9IGtleS5zcGxpdChcIltdXCIpO1xuXHRpZiAocGF0aC5sZW5ndGggPT09IDEpIHJldHVybiBrZXk7XG5cdHZhciBjdXIgPSBwYXRoWzBdO1xuXHR2YXIga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG5cblx0Zm9yICh2YXIgaSA9IDEsIGxlbiA9IHBhdGgubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRjdXIgKz0gXCJbXCIgKyBmaW5kTGFzdEluZGV4KGtleXMsIGN1cikgKyBcIl1cIiArIHBhdGhbaV07XG5cdH1cblxuXHRyZXR1cm4gY3VyO1xufVxuXG4vKipcbiAqIEdpdmVuIGEgcGF0aCB0byBwdXNoIHRvIHdpbGwgcmV0dXJuIHRoZSBuZXh0IHZhbGlkIGluZGV4IGlmIHBvc3NpYmxlLlxuICogRWc6IGFbYl1bXSAtPiAwIC8vIGlmIGFycmF5IGlzIGVtcHR5LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGtleXNcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKi9cbmZ1bmN0aW9uIGZpbmRMYXN0SW5kZXggKGtleXMsIHBhdGgpIHtcblx0dmFyIGxhc3QgPSAtMTtcblxuXHRmb3IgKHZhciBrZXksIGkgPSBrZXlzLmxlbmd0aDsgaS0tOykge1xuXHRcdGtleSA9IGtleXNbaV07XG5cdFx0aWYgKGtleS5pbmRleE9mKHBhdGgpICE9PSAwKSBjb250aW51ZTtcblx0XHRrZXkgPSBrZXkucmVwbGFjZShwYXRoLCBcIlwiKTtcblx0XHRrZXkgPSBrZXkuc2xpY2UoMSwga2V5LmluZGV4T2YoXCJdXCIpKTtcblx0XHRpZiAoa2V5ID4gbGFzdCkgbGFzdCA9IE51bWJlcihrZXkpO1xuXHR9XG5cblx0cmV0dXJuIGxhc3QgKyAxO1xufVxuXG5xU2V0LmZsYXQgICAgICA9IGZTZXQ7XG5tb2R1bGUuZXhwb3J0cyA9IHFTZXQ7XG4iLCIndXNlIHN0cmljdCdcblxudmFyIEh0dHBFcnJvciA9IHJlcXVpcmUoJ0ByaWxsL2Vycm9yJylcbnZhciBSZXF1ZXN0ID0gcmVxdWlyZSgnLi9yZXF1ZXN0JylcbnZhciBSZXNwb25zZSA9IHJlcXVpcmUoJy4vcmVzcG9uc2UnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRleHRcblxuLyoqXG4gKiBDcmVhdGVzIGFuIGluY29tbWluZyBtZXNzYWdlIGNvbnRleHQuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge0luY29tbWluZ01lc3NhZ2V9IHJlcSAtIEEgbm9kZWpzIHN0eWxlIHJlcXVlc3Qgb2JqZWN0LlxuICogQHBhcmFtIHtTZXJ2ZXJSZXNwb25zZX0gcmVzIC0gQSBub2RlanMgc3R5bGUgcmVzcG9uc2Ugb2JqZWN0LlxuICovXG5mdW5jdGlvbiBDb250ZXh0IChyZXEsIHJlcykge1xuICB0aGlzLnJlcSA9IG5ldyBSZXF1ZXN0KHRoaXMsIHJlcSlcbiAgdGhpcy5yZXMgPSBuZXcgUmVzcG9uc2UodGhpcywgcmVzKVxuICB0aGlzLmZhaWwgPSB0aGlzLmZhaWwuYmluZCh0aGlzKVxuICB0aGlzLmFzc2VydCA9IHRoaXMuYXNzZXJ0LmJpbmQodGhpcylcbiAgdGhpcy5sb2NhbHMgPSB7fVxufVxudmFyIGNvbnRleHQgPSBDb250ZXh0LnByb3RvdHlwZVxuXG4vKipcbiAqIFRocm93IGFuIGh0dHAgZXJyb3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8TnVtYmVyfSBjb2RlIC0gVGhlIHN0YXR1cyBjb2RlIGZvciB0aGUgZXJyb3IuXG4gKiBAcGFyYW0ge1N0cmluZ30gW21lc3NhZ2VdIC0gT3B0aW9uYWwgc3RhdHVzIG1lc3NhZ2UuXG4gKiBAcGFyYW0ge09iamVjdH0gW21ldGFdIC0gT3B0aW9uYWwgb2JqZWN0IHRvIG1lcmdlIG9udG8gdGhlIGVycm9yLlxuICogQHRocm93cyBIdHRwRXJyb3JcbiAqL1xuY29udGV4dC5mYWlsID0gZnVuY3Rpb24gdGhyb3dIdHRwIChjb2RlLCBtZXNzYWdlLCBtZXRhKSB7XG4gIGlmICh0eXBlb2YgY29kZSAhPT0gJ251bWJlcicpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1JpbGwjY3R4LmZhaWw6IFN0YXR1cyBjb2RlIG11c3QgYmUgYSBudW1iZXIuJylcbiAgdmFyIGVycm9yID0gbmV3IEh0dHBFcnJvcihjb2RlLCBtZXNzYWdlLCBtZXRhKVxuICB0aGlzLnJlcy5zdGF0dXMgPSBlcnJvci5jb2RlXG4gIHRoaXMucmVzLm1lc3NhZ2UgPSBlcnJvci5tZXNzYWdlXG4gIHRocm93IGVycm9yXG59XG5cbi8qKlxuICogVGhyb3cgYW4gaHR0cCBlcnJvciBpZiBhIHZhbHVlIGlzIG5vdCB0cnV0aHkuXG4gKlxuICogQHBhcmFtIHsqfSB2YWwgLSBUaGUgdmFsdWUgdG8gdGVzdCBmb3IgdHJ1dGh5bmVzcy5cbiAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gY29kZSAtIFRoZSBzdGF0dXMgY29kZSBmb3IgdGhlIGVycm9yLlxuICogQHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSAtIE9wdGlvbmFsIHN0YXR1cyBtZXNzYWdlLlxuICogQHBhcmFtIHtPYmplY3R9IFttZXRhXSAtIE9wdGlvbmFsIG9iamVjdCB0byBtZXJnZSBvbnRvIHRoZSBlcnJvci5cbiAqIEB0aHJvd3MgSHR0cEVycm9yXG4gKi9cbmNvbnRleHQuYXNzZXJ0ID0gZnVuY3Rpb24gYXNzZXJ0SHR0cCAodmFsLCBjb2RlLCBtZXNzYWdlLCBtZXRhKSB7XG4gIGlmICh0eXBlb2YgY29kZSAhPT0gJ251bWJlcicpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1JpbGwjY3R4LmFzc2VydDogU3RhdHVzIGNvZGUgbXVzdCBiZSBhIG51bWJlci4nKVxuICBpZiAoIXZhbCkgdGhpcy5mYWlsKGNvZGUsIG1lc3NhZ2UsIG1ldGEpXG59XG4iLCIndXNlIHN0cmljdCdcblxudmFyIHBhdGhUb1JlZ0V4cCA9IHJlcXVpcmUoJ3BhdGgtdG8tcmVnZXhwJylcbnZhciBodHRwID0gcmVxdWlyZSgnQHJpbGwvaHR0cCcpXG52YXIgaHR0cHMgPSByZXF1aXJlKCdAcmlsbC9odHRwcycpXG52YXIgY2hhaW4gPSByZXF1aXJlKCdAcmlsbC9jaGFpbicpXG52YXIgSHR0cEVycm9yID0gcmVxdWlyZSgnQHJpbGwvZXJyb3InKVxudmFyIENvbnRleHQgPSByZXF1aXJlKCcuL2NvbnRleHQnKVxudmFyIHJlc3BvbmQgPSByZXF1aXJlKCcuL3Jlc3BvbmQnKVxudmFyIHBhcnNlID0gcGF0aFRvUmVnRXhwLnBhcnNlXG52YXIgdG9rZW5zVG9SZWdFeHAgPSBwYXRoVG9SZWdFeHAudG9rZW5zVG9SZWdFeHBcbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZVxudmFyIHJpbGwgPSBSaWxsLnByb3RvdHlwZVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJpbGwuZGVmYXVsdCA9IFJpbGxcblxuLyoqXG4gKiBDcmVhdGVzIGEgdW5pdmVyc2FsIGFwcCB0aGF0IHdpbGwgcnVuIG1pZGRsZXdhcmUgZm9yIGEgaW5jb21taW5nIHJlcXVlc3QuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFJpbGwgKCkge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUmlsbCkpIHJldHVybiBuZXcgUmlsbCgpXG4gIHRoaXMuc3RhY2sgPSBbXVxufVxuXG4vKipcbiAqIFN0YXJ0cyBhIG5vZGUvcmlsbCBzZXJ2ZXIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRzXVxuICogQHBhcmFtIHtTdHJpbmd9IG9wdHMuaXBcbiAqIEBwYXJhbSB7TnVtYmVyfSBvcHRzLnBvcnRcbiAqIEBwYXJhbSB7TnVtYmVyfSBvcHRzLmJhY2tsb2dcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzLnRsc1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqIEByZXR1cm4ge1NlcnZlcn1cbiAqL1xucmlsbC5saXN0ZW4gPSBmdW5jdGlvbiBsaXN0ZW4gKG9wdHMsIGNiKSB7XG4gIC8vIE1ha2Ugb3B0aW9ucyBvcHRpb25hbC5cbiAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY2IgPSBvcHRzXG4gICAgb3B0cyA9IG51bGxcbiAgfVxuXG4gIG9wdHMgPSBvcHRzIHx8IHt9XG4gIG9wdHMucG9ydCA9IG9wdHMucG9ydCAhPSBudWxsID8gb3B0cy5wb3J0IDogbnVsbFxuXG4gIHZhciBzZXJ2ZXIgPSAob3B0cy50bHMpXG4gICAgPyBodHRwcy5jcmVhdGVTZXJ2ZXIob3B0cy50bHMsIHRoaXMuaGFuZGxlcigpKVxuICAgIDogaHR0cC5jcmVhdGVTZXJ2ZXIodGhpcy5oYW5kbGVyKCkpXG5cbiAgcmV0dXJuIHNlcnZlci5saXN0ZW4ob3B0cy5wb3J0LCBvcHRzLmlwLCBvcHRzLmJhY2tsb2csIGNiKVxufVxuXG4vKipcbiAqIFRha2VzIHRoZSBjdXJyZW50IG1pZGRsZXdhcmUgc3RhY2ssIGNoYWlucyBpdCB0b2dldGhlciBhbmRcbiAqIHJldHVybnMgYSB2YWxpZCBoYW5kbGVyIGZvciBhIG5vZGUganMgc3R5bGUgc2VydmVyIHJlcXVlc3QuXG4gKlxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cbnJpbGwuaGFuZGxlciA9IGZ1bmN0aW9uIGhhbmRsZXIgKCkge1xuICB2YXIgZm4gPSBjaGFpbih0aGlzLnN0YWNrKVxuICByZXR1cm4gZnVuY3Rpb24gaGFuZGxlSW5jb21taW5nTWVzc2FnZSAocmVxLCByZXMpIHtcbiAgICByZXMuc3RhdHVzQ29kZSA9IDQwNFxuICAgIHZhciBjdHggPSBuZXcgQ29udGV4dChyZXEsIHJlcylcblxuICAgIGZuKGN0eClcbiAgICAgIC5jYXRjaChoYW5kbGVFcnJvcilcbiAgICAgIC50aGVuKGZpbmlzaClcblxuICAgIGZ1bmN0aW9uIGhhbmRsZUVycm9yIChlcnIpIHtcbiAgICAgIGlmIChOdW1iZXIoY3R4LnJlcy5zdGF0dXMpID09PSA0MDQpIHtcbiAgICAgICAgY3R4LnJlcy5zdGF0dXMgPSA1MDBcbiAgICAgIH1cbiAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIEh0dHBFcnJvcikpIHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgY29uc29sZSAmJiBjb25zb2xlLmVycm9yICYmIGNvbnNvbGUuZXJyb3IoZXJyKVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZpbmlzaCAoKSB7IHJlc3BvbmQoY3R4KSB9XG4gIH1cbn1cblxuLyoqXG4gKiBBcHBlbmQgbmV3IG1pZGRsZXdhcmUgdG8gdGhlIGN1cnJlbnQgcmlsbCBhcHBsaWNhdGlvbiBzdGFjay5cbiAqXG4gKiBAZXhhbXBsZVxuICogcmlsbC51c2UoZm4xLCBmbjIpXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IFtjb25maWddIC0gT3B0aW9uYWwgY29uZmlnIHRoYXQgbXVzdCBiZSBtYXRjaGVkIGZvciB0aGUgbWlkZGxld2FyZSB0byBydW4uXG4gKiBAcGFyYW0ge0Z1bmN0aW9uLi4ufSBtaWRkbGV3YXJlIC0gRnVuY3Rpb25zIHRvIHJ1biBkdXJpbmcgYW4gaW5jb21taW5nIHJlcXVlc3QuXG4gKi9cbnJpbGwudXNlID0gZnVuY3Rpb24gdXNlICgpIHtcbiAgdmFyIHN0YXJ0ID0gdGhpcy5zdGFjay5sZW5ndGhcbiAgdmFyIGVuZCA9IHRoaXMuc3RhY2subGVuZ3RoICs9IGFyZ3VtZW50cy5sZW5ndGhcblxuICBmb3IgKHZhciBpID0gZW5kOyBzdGFydCA8IGktLTspIHtcbiAgICB0aGlzLnN0YWNrW2ldID0gYXJndW1lbnRzW2kgLSBzdGFydF1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogU2ltcGxlIHN5bnRhY3RpYyBzdWdhciBmb3IgZnVuY3Rpb25zIHRoYXRcbiAqIHdpc2ggdG8gbW9kaWZ5IHRoZSBjdXJyZW50IHJpbGwgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbi4uLn0gdHJhbnNmb3JtZXJzIC0gRnVuY3Rpb25zIHRoYXQgd2lsbCBtb2RpZnkgdGhlIHJpbGwgaW5zdGFuY2UuXG4gKi9cbnJpbGwuc2V0dXAgPSBmdW5jdGlvbiBzZXR1cCAoKSB7XG4gIGZvciAodmFyIGZuLCBsZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgZm4gPSBhcmd1bWVudHNbaV1cbiAgICBpZiAoIWZuKSBjb250aW51ZVxuICAgIGlmICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpIGZuKHRoaXMpXG4gICAgZWxzZSB0aHJvdyBuZXcgVHlwZUVycm9yKCdSaWxsI3NldHVwOiBTZXR1cCBtdXN0IGJlIGEgZnVuY3Rpb24gb3IgZmFsc2V5LicpXG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIFVzZSBtaWRkbGV3YXJlIGF0IGEgc3BlY2lmaWMgcGF0aG5hbWUuXG4gKi9cbnJpbGwuYXQgPSBmdW5jdGlvbiBhdCAocGF0aG5hbWUpIHtcbiAgaWYgKHR5cGVvZiBwYXRobmFtZSAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1JpbGwjYXQ6IFBhdGggbmFtZSBtdXN0IGJlIGEgc3RyaW5nLicpXG5cbiAgdmFyIGtleXMgPSBbXVxuICB2YXIgcmVnID0gdG9SZWcocGF0aG5hbWUsIGtleXMsIHsgZW5kOiBmYWxzZSwgZGVsaW1pdGVyOiAnLycgfSlcbiAgdmFyIGZuID0gY2hhaW4oc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKVxuXG4gIHJldHVybiB0aGlzLnVzZShmdW5jdGlvbiBtYXRjaFBhdGhuYW1lIChjdHgsIG5leHQpIHtcbiAgICB2YXIgcGF0aG5hbWUgPSBjdHgucmVxLm1hdGNoUGF0aFxuICAgIHZhciBtYXRjaGVzID0gcGF0aG5hbWUubWF0Y2gocmVnKVxuICAgIC8vIENoZWNrIGlmIHdlIG1hdGNoZWQgdGhlIHdob2xlIHBhdGguXG4gICAgaWYgKCFtYXRjaGVzIHx8IG1hdGNoZXNbMF0gIT09IHBhdGhuYW1lKSByZXR1cm4gbmV4dCgpXG5cbiAgICAvLyBDaGVjayBpZiBwYXJhbXMgbWF0Y2guXG4gICAgZm9yICh2YXIga2V5LCBtYXRjaCwgaSA9IGtleXMubGVuZ3RoOyBpLS07KSB7XG4gICAgICBrZXkgPSBrZXlzW2ldXG4gICAgICBtYXRjaCA9IG1hdGNoZXNbaSArIDFdXG4gICAgICBpZiAoa2V5LnJlcGVhdCkgbWF0Y2ggPSBtYXRjaCA9PSBudWxsID8gW10gOiBtYXRjaC5zcGxpdCgnLycpXG4gICAgICBjdHgucmVxLnBhcmFtc1trZXkubmFtZV0gPSBtYXRjaFxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBwYXRoIGZvciBuZXN0ZWQgcm91dGVzLlxuICAgIHZhciBtYXRjaGVkID0gbWF0Y2hlc1ttYXRjaGVzLmxlbmd0aCAtIDFdIHx8ICcnXG4gICAgaWYgKGN0eC5yZXEubWF0Y2hQYXRoICE9PSBtYXRjaGVkKSBjdHgucmVxLm1hdGNoUGF0aCA9ICcvJyArIG1hdGNoZWRcblxuICAgIC8vIFJ1biBtaWRkbGV3YXJlLlxuICAgIHJldHVybiBmbihjdHgsIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIFJlc2V0IG5lc3RlZCBwYXRobmFtZSBiZWZvcmUgY2FsbGluZyBsYXRlciBtaWRkbGV3YXJlLlxuICAgICAgY3R4LnJlcS5tYXRjaFBhdGggPSBwYXRobmFtZVxuICAgICAgLy8gUnVuIHNpYmxpbmcgbWlkZGxld2FyZS5cbiAgICAgIHJldHVybiBuZXh0KClcbiAgICB9KVxuICB9KVxufVxuXG4vKipcbiAqIFVzZSBtaWRkbGV3YXJlIGF0IGEgc3BlY2lmaWMgaG9zdG5hbWUuXG4gKi9cbnJpbGwuaG9zdCA9IGZ1bmN0aW9uIGhvc3QgKGhvc3RuYW1lKSB7XG4gIGlmICh0eXBlb2YgaG9zdG5hbWUgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdSaWxsI2hvc3Q6IEhvc3QgbmFtZSBtdXN0IGJlIGEgc3RyaW5nLicpXG5cbiAgdmFyIGtleXMgPSBbXVxuICB2YXIgcmVnID0gdG9SZWcoaG9zdG5hbWUsIGtleXMsIHsgc3RyaWN0OiB0cnVlLCBkZWxpbWl0ZXI6ICcuJyB9KVxuICB2YXIgZm4gPSBjaGFpbihzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpXG5cbiAgcmV0dXJuIHRoaXMudXNlKGZ1bmN0aW9uIG1hdGNoSG9zdCAoY3R4LCBuZXh0KSB7XG4gICAgdmFyIGhvc3RuYW1lID0gY3R4LnJlcS5tYXRjaEhvc3RcbiAgICB2YXIgbWF0Y2hlcyA9IGhvc3RuYW1lLm1hdGNoKHJlZylcblxuICAgIC8vIENoZWNrIGlmIHdlIG1hdGNoZWQgdGhlIHdob2xlIGhvc3RuYW1lLlxuICAgIGlmICghbWF0Y2hlcyB8fCBtYXRjaGVzWzBdICE9PSBob3N0bmFtZSkgcmV0dXJuIG5leHQoKVxuXG4gICAgLy8gSGVyZSB3ZSBjaGVjayBmb3IgdGhlIGR5bmFtaWNhbGx5IG1hdGNoZWQgc3ViZG9tYWlucy5cbiAgICBmb3IgKHZhciBrZXksIG1hdGNoLCBpID0ga2V5cy5sZW5ndGg7IGktLTspIHtcbiAgICAgIGtleSA9IGtleXNbaV1cbiAgICAgIG1hdGNoID0gbWF0Y2hlc1tpICsgMV1cbiAgICAgIGlmIChrZXkucmVwZWF0KSBtYXRjaCA9IG1hdGNoID09IG51bGwgPyBbXSA6IG1hdGNoLnNwbGl0KCcuJylcbiAgICAgIGN0eC5yZXEuc3ViZG9tYWluc1trZXkubmFtZV0gPSBtYXRjaFxuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBob3N0bmFtZSBmb3IgbmVzdGVkIHJvdXRlcy5cbiAgICB2YXIgbWF0Y2hlZCA9IG1hdGNoZXNbbWF0Y2hlcy5sZW5ndGggLSAxXSB8fCAnJ1xuICAgIGlmIChjdHgucmVxLm1hdGNoSG9zdCAhPT0gbWF0Y2hlZCkgY3R4LnJlcS5tYXRjaEhvc3QgPSBtYXRjaGVkXG5cbiAgICAvLyBSdW4gbWlkZGxld2FyZS5cbiAgICByZXR1cm4gZm4oY3R4LCBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBSZXNldCBuZXN0ZWQgaG9zdG5hbWUuXG4gICAgICBjdHgucmVxLm1hdGNoSG9zdCA9IGhvc3RuYW1lXG4gICAgICAvLyBSdW4gc2libGluZyBtaWRkbGV3YXJlLlxuICAgICAgcmV0dXJuIG5leHQoKVxuICAgIH0pXG4gIH0pXG59XG5cbi8qKlxuICogVXNlIG1pZGRsZXdhcmUgZm9yIGEgc3BlY2lmaWMgbWV0aG9kIC8gcGF0aG5hbWUuXG4gKi9cbmh0dHAuTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgdmFyIG5hbWUgPSBtZXRob2QudG9Mb3dlckNhc2UoKVxuICByaWxsW25hbWVdID0gZnVuY3Rpb24gKHBhdGhuYW1lKSB7XG4gICAgdmFyIG9mZnNldCA9IHR5cGVvZiBwYXRobmFtZSA9PT0gJ3N0cmluZycgPyAxIDogMFxuICAgIHZhciBmbiA9IGNoYWluKHNsaWNlLmNhbGwoYXJndW1lbnRzLCBvZmZzZXQpKVxuICAgIGlmIChvZmZzZXQgPT09IDEpIHJldHVybiB0aGlzLmF0KHBhdGhuYW1lLCBtYXRjaE1ldGhvZClcbiAgICByZXR1cm4gdGhpcy51c2UobWF0Y2hNZXRob2QpXG5cbiAgICBmdW5jdGlvbiBtYXRjaE1ldGhvZCAoY3R4LCBuZXh0KSB7XG4gICAgICBpZiAoY3R4LnJlcS5tZXRob2QgIT09IG1ldGhvZCkgcmV0dXJuIG5leHQoKVxuICAgICAgcmV0dXJuIGZuKGN0eCwgbmV4dClcbiAgICB9XG4gIH1cbn0pXG5cbi8qKlxuICogU21hbGwgd3JhcHBlciBhcm91bmQgcGF0aCB0byByZWdleHAgdGhhdCB0cmVhdHMgYSBzcGxhdCBwYXJhbSBcIi8qXCIgYXMgb3B0aW9uYWwuXG4gKiBUaGlzIG1ha2VzIG1vdW50aW5nIGVhc2llciBzaW5jZSB0eXBpY2FsbHkgd2hlbiB5b3UgZG8gYSBwYXRoIGxpa2UgXCIvdGVzdC8qXCIgeW91IGFsc28gd2FudCB0byB0cmVhdCBcIi90ZXN0XCIgYXMgdmFsaWQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhuYW1lIC0gdGhlIHBhdGggdG8gY29udmVydCB0byBhIHJlZ2V4cC5cbiAqIEBwYXJhbSB7QXJyYXl9IFtrZXlzXSAtIGEgcGxhY2UgdG8gc3RvcmUgbWF0Y2hlZCBwYXJhbSBrZXlzLlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRzXSAtIG9wdGlvbnMgcGFzc2VkIHRvIHBhdGhUb1JlZ0V4cC5cbiAqIEByZXR1cm4ge1JlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gdG9SZWcgKHBhdGhuYW1lLCBrZXlzLCBvcHRzKSB7XG4gIC8vIEZpcnN0IHBhcnNlIHBhdGggaW50byB0b2tlbnMuXG4gIHZhciB0b2tlbnMgPSBwYXJzZShwYXRobmFtZSlcblxuICAvLyBGaW5kIHRoZSBsYXN0IHRva2VuIChjaGVja2luZyBmb3Igc3BsYXQgcGFyYW1zKS5cbiAgdmFyIHNwbGF0ID0gdG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXVxuXG4gIC8vIENoZWNrIGlmIHRoZSBsYXN0IHRva2VuIGlzIGEgc3BsYXQgYW5kIG1ha2UgaXQgb3B0aW9uYWwuXG4gIGlmIChzcGxhdCAmJiBzcGxhdC5hc3Rlcmlzaykgc3BsYXQub3B0aW9uYWwgPSB0cnVlXG5cbiAgLy8gQ29udmVydCB0aGUgdG9rZW5zIHRvIGEgcmVnZXhwLlxuICB2YXIgcmUgPSB0b2tlbnNUb1JlZ0V4cCh0b2tlbnMsIG9wdHMpXG5cbiAgLy8gQXNzaWduIGtleXMgdG8gZnJvbSByZWdleHAuXG4gIHJlLmtleXMgPSBrZXlzXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0b2tlbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAodHlwZW9mIHRva2Vuc1tpXSA9PT0gJ29iamVjdCcpIGtleXMucHVzaCh0b2tlbnNbaV0pXG4gIH1cblxuICByZXR1cm4gcmVcbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgVVJMID0gcmVxdWlyZSgndXJsJylcbnZhciBxU2V0ID0gcmVxdWlyZSgncS1zZXQnKVxudmFyIHRvRmllbGQgPSByZXF1aXJlKCdoZWFkZXItZmllbGQnKVxudmFyIGNvb2tpZXMgPSByZXF1aXJlKCdAcmlsbC9jb29raWVzJylcblxubW9kdWxlLmV4cG9ydHMgPSBSZXF1ZXN0XG5cbi8qKlxuICogV3JhcHBlciBhcm91bmQgbm9kZWpzIGBJbmNvbW1pbmdNZXNzYWdlYCB0aGF0IGhhcyBwcmUgcGFyc2VkIHVybFxuICogYW5kIG90aGVyIGNvbnZlaW5lbmNlcy5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7Q29udGV4dH0gY3R4IC0gVGhlIGNvbnRleHQgZm9yIHRoZSByZXF1ZXN0LlxuICogQHBhcmFtIHtJbmNvbW1pbmdNZXNzYWdlfSByZXEgLSBUaGUgb3JpZ2luYWwgbm9kZSByZXF1ZXN0LlxuICovXG5mdW5jdGlvbiBSZXF1ZXN0IChjdHgsIHJlcSkge1xuICB2YXIgaG9zdCA9IHJlcS5oZWFkZXJzWydob3N0J11cbiAgdmFyIHByb3RvY29sID0gKHJlcS5jb25uZWN0aW9uLmVuY3J5cHRlZCkgPyAnaHR0cHMnIDogJ2h0dHAnXG4gIHZhciBwYXJzZWQgPSBVUkwucGFyc2UocHJvdG9jb2wgKyAnOi8vJyArIGhvc3QgKyByZXEudXJsLCB0cnVlKVxuICB0aGlzLmN0eCA9IGN0eFxuICB0aGlzLm9yaWdpbmFsID0gcmVxXG4gIHRoaXMubWV0aG9kID0gcmVxLm1ldGhvZFxuICB0aGlzLmhlYWRlcnMgPSByZXEuaGVhZGVyc1xuICB0aGlzLmNvb2tpZXMgPSBjb29raWVzLnBhcnNlKHRoaXMuaGVhZGVyc1snY29va2llJ10pXG4gIHRoaXMucGFyYW1zID0ge31cbiAgdGhpcy5ocmVmID0gcGFyc2VkLmhyZWZcbiAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sXG4gIHRoaXMucG9ydCA9IHBhcnNlZC5wb3J0XG4gIHRoaXMuaG9zdCA9IHBhcnNlZC5ob3N0XG4gIHRoaXMuaG9zdG5hbWUgPSB0aGlzLm1hdGNoSG9zdCA9IHBhcnNlZC5ob3N0bmFtZVxuICB0aGlzLnBhdGggPSBwYXJzZWQucGF0aFxuICB0aGlzLnBhdGhuYW1lID0gdGhpcy5tYXRjaFBhdGggPSBwYXJzZWQucGF0aG5hbWVcbiAgdGhpcy5zZWFyY2ggPSBwYXJzZWQuc2VhcmNoXG4gIHRoaXMuaGFzaCA9IHBhcnNlZC5oYXNoXG4gIHRoaXMucXVlcnkgPSB7fVxuICB0aGlzLm9yaWdpbiA9IHRoaXMucHJvdG9jb2wgKyAnOi8vJyArIHRoaXMuaG9zdFxuICB0aGlzLnNlY3VyZSA9IHRoaXMucHJvdG9jb2wgPT09ICdodHRwcydcbiAgdGhpcy5zdWJkb21haW5zID0gU3RyaW5nKHRoaXMuaG9zdG5hbWUpLnNwbGl0KCcuJykucmV2ZXJzZSgpLnNsaWNlKDIpXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIHRoaXMuaXAgPSAoXG4gICAgcmVxLmNvbm5lY3Rpb24ucmVtb3RlQWRkcmVzcyB8fFxuICAgIHJlcS5zb2NrZXQucmVtb3RlQWRkcmVzcyB8fFxuICAgIChyZXEuY29ubmVjdGlvbi5zb2NrZXQgJiYgcmVxLmNvbm5lY3Rpb24uc29ja2V0LnJlbW90ZUFkZHJlc3MpXG4gIClcblxuICAvLyBTdXBwb3J0IG5lc3RlZCBxdWVyeXN0cmluZ3MuXG4gIHZhciBxdWVyeSA9IHBhcnNlZC5xdWVyeVxuICBmb3IgKHZhciBrZXkgaW4gcXVlcnkpIHFTZXQodGhpcy5xdWVyeSwga2V5LCBxdWVyeVtrZXldKVxufVxudmFyIHJlcXVlc3QgPSBSZXF1ZXN0LnByb3RvdHlwZVxuXG4vKipcbiAqIFV0aWxpdHkgdG8gcmV0cmlldmUgYSBoZWFkZXIgZm9yIHRoZSByZXF1ZXN0LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWVsZFxuICogQHJldHVybiB7QXJyYXl8U3RyaW5nfVxuICovXG5yZXF1ZXN0LmdldCA9IGZ1bmN0aW9uIGdldCAoZmllbGQpIHtcbiAgcmV0dXJuIHRoaXMuaGVhZGVyc1t0b0ZpZWxkKGZpZWxkKV1cbn1cbiIsIid1c2Ugc3RyaWN0J1xuXG52YXIgYnl0ZUxlbmd0aCA9IHJlcXVpcmUoJ2J5dGUtbGVuZ3RoJylcbnZhciBjaGVja1R5cGUgPSByZXF1aXJlKCdjb250ZW50LWNoZWNrJylcbnZhciBzdGF0dXNlcyA9IHJlcXVpcmUoJ3N0YXR1c2VzJylcbnZhciBpc1R5cGUgPSByZXF1aXJlKCdpcy10eXBlb2YnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc3BvbmRcblxuLyoqXG4gKiBSdW5zIGdlbmVyYWwgY2xlYW4gdXAgb24gYSByZXF1ZXN0IGFuZCBlbmRzIGl0LlxuICovXG5mdW5jdGlvbiByZXNwb25kIChjdHgpIHtcbiAgdmFyIHJlcSA9IGN0eC5yZXFcbiAgdmFyIHJlcyA9IGN0eC5yZXNcbiAgdmFyIGJvZHkgPSByZXMuYm9keVxuICB2YXIgb3JpZ2luYWwgPSByZXMub3JpZ2luYWxcbiAgdmFyIGlzU3RyZWFtID0gaXNUeXBlLnN0cmVhbShib2R5KVxuICB2YXIgaXNCdWZmZXIgPSBpc1R5cGUuYnVmZmVyKGJvZHkpXG5cbiAgLy8gQWxsb3cgc2tpcHBpbmcgcmVzcG9uc2UuXG4gIGlmIChyZXMucmVzcG9uZCA9PT0gZmFsc2UpIHJldHVyblxuICAvLyBTa2lwIHJlcXVlc3QgZW5kZWQgZXh0ZXJuYWxseS5cbiAgaWYgKG9yaWdpbmFsLmhlYWRlcnNTZW50KSByZXR1cm5cblxuICAvLyBBcHBseSBkZWZhdWx0IHN0YXR1c2VzLlxuICBpZiAoTnVtYmVyKHJlcy5zdGF0dXMpID09PSA0MDQpIHtcbiAgICAvLyBFbnN1cmUgcmVkaXJlY3Qgc3RhdHVzLlxuICAgIGlmIChyZXMuZ2V0KCdMb2NhdGlvbicpKSByZXMuc3RhdHVzID0gMzAyXG4gICAgLy8gRGVmYXVsdCB0aGUgc3RhdHVzIHRvIDIwMCBpZiB0aGVyZSBpcyBzdWJzdGFuY2UgdG8gdGhlIHJlc3BvbnNlLlxuICAgIGVsc2UgaWYgKGJvZHkpIHJlcy5zdGF0dXMgPSAyMDBcbiAgfVxuXG4gIC8vIERlZmF1bHQgc3RhdHVzIG1lc3NhZ2UgYmFzZWQgb24gc3RhdHVzIGNvZGUuXG4gIHJlcy5tZXNzYWdlID0gcmVzLm1lc3NhZ2UgfHwgc3RhdHVzZXNbcmVzLnN0YXR1c11cblxuICAvLyBFbnN1cmUgbm8gY29udGVudC10eXBlIGZvciBlbXB0eSByZXNwb25zZXMuXG4gIGlmIChyZXEubWV0aG9kID09PSAnSEVBRCcgfHwgc3RhdHVzZXMuZW1wdHlbcmVzLnN0YXR1c10gfHwgIWJvZHkpIHtcbiAgICBib2R5ID0gbnVsbFxuICAgIHJlcy5yZW1vdmUoJ0NvbnRlbnQtVHlwZScpXG4gICAgcmVzLnJlbW92ZSgnQ29udGVudC1MZW5ndGgnKVxuICB9IGVsc2Uge1xuICAgIC8vIEF0dGVtcHQgdG8gZ3Vlc3MgY29udGVudCB0eXBlLlxuICAgIGlmICghcmVzLmdldCgnQ29udGVudC1UeXBlJykpIHJlcy5zZXQoJ0NvbnRlbnQtVHlwZScsIGNoZWNrVHlwZShib2R5KSlcbiAgICAvLyBTdHJpbmdpZnkgb2JqZWN0cyB0aGF0IGFyZSBub3QgYnVmZmVycy5cbiAgICBpZiAodHlwZW9mIGJvZHkgPT09ICdvYmplY3QnICYmICFpc1N0cmVhbSAmJiAhaXNCdWZmZXIpIGJvZHkgPSBKU09OLnN0cmluZ2lmeShib2R5KVxuICAgIC8vIEF0dGVtcHQgdG8gZ3Vlc3MgY29udGVudC1sZW5ndGguXG4gICAgaWYgKCFyZXMuZ2V0KCdDb250ZW50LUxlbmd0aCcpICYmICFpc1N0cmVhbSkgcmVzLnNldCgnQ29udGVudC1MZW5ndGgnLCBieXRlTGVuZ3RoKGJvZHkpKVxuICB9XG5cbiAgLy8gU2VuZCBvZmYgaGVhZGVycy5cbiAgb3JpZ2luYWwud3JpdGVIZWFkKHJlcy5zdGF0dXMsIHJlcy5tZXNzYWdlLCBjbGVhbihyZXMuaGVhZGVycykpXG4gIC8vIEFsbG93IGZvciByZXF1ZXN0cyB0byBzdGF5IG9wZW4uXG4gIGlmIChyZXMuZW5kID09PSBmYWxzZSkgcmV0dXJuXG4gIC8vIEZpbmlzaCByZXNwb25zZS5cbiAgaWYgKGlzU3RyZWFtKSBib2R5LnBpcGUob3JpZ2luYWwpXG4gIGVsc2Ugb3JpZ2luYWwuZW5kKGJvZHkpXG59XG5cbi8qKlxuICogVXRpbGl0eSB0byByZW1vdmUgZW1wdHkgdmFsdWVzIGZyb20gYW4gb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gY2xlYW4gKG9iaikge1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKG9ialtrZXldID09IG51bGwgfHwgb2JqW2tleV0ubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgb2JqW2tleV1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9ialxufVxuIiwiJ3VzZSBzdHJpY3QnXG5cbnZhciBVUkwgPSByZXF1aXJlKCd1cmwnKVxudmFyIHN0YXR1c2VzID0gcmVxdWlyZSgnc3RhdHVzZXMnKVxudmFyIHRvRmllbGQgPSByZXF1aXJlKCdoZWFkZXItZmllbGQnKVxudmFyIGNvb2tpZXMgPSByZXF1aXJlKCdAcmlsbC9jb29raWVzJylcblxubW9kdWxlLmV4cG9ydHMgPSBSZXNwb25zZVxuXG4vKipcbiAqIFdyYXBwZXIgYXJvdW5kIG5vZGVqcyBgU2VydmVyUmVzcG9uc2VgLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtDb250ZXh0fSBjdHggLSBUaGUgY29udGV4dCBmb3IgdGhlIHJlcXVlc3QuXG4gKiBAcGFyYW0ge1NlcnZlclJlc3BvbnNlfSByZXMgLSBUaGUgb3JpZ2luYWwgbm9kZSByZXNwb25zZS5cbiAqL1xuZnVuY3Rpb24gUmVzcG9uc2UgKGN0eCwgcmVzKSB7XG4gIHRoaXMuY3R4ID0gY3R4XG4gIHRoaXMub3JpZ2luYWwgPSByZXNcbiAgdGhpcy5zdGF0dXMgPSByZXMuc3RhdHVzQ29kZVxuICB0aGlzLmJvZHkgPSB1bmRlZmluZWRcbiAgdGhpcy5oZWFkZXJzID0ge31cbiAgcmVzLm9uY2UoJ2ZpbmlzaCcsIGZ1bmN0aW9uICgpIHsgY3R4LnJlcy5maW5pc2hlZCA9IHRydWUgfSlcbn1cbnZhciByZXNwb25zZSA9IFJlc3BvbnNlLnByb3RvdHlwZVxuXG4vKipcbiAqIEFwcGVuZHMgdG8gdGhlIGN1cnJlbnQgc2V0LWNvb2tpZSBoZWFkZXIsIGFkZGluZyBhIG5ldyBjb29raWUgd2l0aCBvcHRpb25zLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgLSB0aGUgbmFtZSBvZiB0aGUgY29va2llLlxuICogQHBhcmFtIHsqfSB2YWwgLSB0aGUgdmFsdWUgZm9yIHRoZSBjb29raWUuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyAtIG9wdGlvbnMgZm9yIHRoZSBjb29raWUuXG4gKi9cbnJlc3BvbnNlLmNvb2tpZSA9IGZ1bmN0aW9uIChrZXksIHZhbCwgb3B0cykge1xuICB0aGlzLmFwcGVuZCgnU2V0LUNvb2tpZScsIGNvb2tpZXMuc2VyaWFsaXplKGtleSwgdmFsLCBvcHRzKSlcbn1cblxuLyoqXG4gKiBEZWxldGVzIGEgY29va2llLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgLSB0aGUgbmFtZSBvZiB0aGUgY29va2llLlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHMgLSBvcHRpb25zIGZvciB0aGUgY29va2llLlxuICovXG5yZXNwb25zZS5jbGVhckNvb2tpZSA9IGZ1bmN0aW9uIChrZXksIG9wdHMpIHtcbiAgb3B0cyA9IG9wdHMgfHwge31cbiAgb3B0cy5leHBpcmVzID0gbmV3IERhdGUoKVxuICB0aGlzLmFwcGVuZCgnU2V0LUNvb2tpZScsIGNvb2tpZXMuc2VyaWFsaXplKGtleSwgJycsIG9wdHMpKVxufVxuXG4vKipcbiAqIEF0dGFjaGVzIHJlbGF0aXZlIGxvY2F0aW9uIGhlYWRlcnMgdG8gcGVyZm9ybSBhIHJlZGlyZWN0LlxuICogV2lsbCByZWRpcmVjdCB0byB0aGUgcmVmZXJyZXIgaWYgXCJiYWNrXCIgaXMgc3VwcGxpZWQgYXMgYSB1cmwuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gcmVkaXJlY3QgdG9vIG9yIFwiYmFja1wiLlxuICogQHBhcmFtIHtTdHJpbmd9IGFsdCAtIFVzZWQgaWYgdGhlIHVybCBpcyBlbXB0eSBvciBcImJhY2tcIiBkb2VzIG5vdCBleGlzdC5cbiAqL1xucmVzcG9uc2UucmVkaXJlY3QgPSBmdW5jdGlvbiByZWRpcmVjdCAodXJsLCBhbHQpIHtcbiAgdmFyIHJlcSA9IHRoaXMuY3R4LnJlcVxuXG4gIC8vIEJhY2sgdXNlcyByZXF1ZXN0IHJlZmVycmVyIGhlYWRlciBhcyBhIHVybC5cbiAgdXJsID0gKHVybCA9PT0gJ2JhY2snKSA/IHJlcS5nZXQoJ1JlZmVycmVyJykgOiB1cmxcbiAgLy8gRGVmYXVsdCB1cmwgdG8gYWx0ZXJuYXRpdmUuXG4gIHVybCA9IHVybCB8fCBhbHRcblxuICBpZiAoIXVybCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1JpbGwjY3R4LnJlcy5yZWRpcmVjdDogQ2Fubm90IHJlZGlyZWN0LCB1cmwgbm90IHNwZWNpZmllZCBhbmQgYWx0ZXJuYXRpdmUgbm90IHByb3ZpZGVkLicpXG4gIH1cblxuICBpZiAoIXN0YXR1c2VzLnJlZGlyZWN0W3RoaXMuc3RhdHVzXSkgdGhpcy5zdGF0dXMgPSAzMDJcblxuICB0aGlzLnNldCgnTG9jYXRpb24nLCBVUkwucmVzb2x2ZShyZXEuaHJlZiwgdXJsKSlcbn1cblxuLyoqXG4gKiBBdHRhY2hlcyByZWxhdGl2ZSByZWZyZXNoIGhlYWRlcnMgdG8gcGVyZm9ybSBhIHRpbWVkIHJlZnJlc2guXG4gKiBXaWxsIHJlZnJlc2ggdG8gdGhlIHJlZmVycmVyIGlmIFwiYmFja1wiIGlzIHN1cHBsaWVkIGFzIGEgdXJsLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBkZWxheSAtIERlbGF5cyB0aGUgcmVmcmVzaCBieSBgZGVsYXlgIHNlY29uZHMuXG4gKiBAcGFyYW0ge1N0cmluZ30gdXJsIC0gVGhlIHVybCB0byByZWZyZXNoIG9yIFwiYmFja1wiLlxuICogQHBhcmFtIHtTdHJpbmd9IGFsdCAtIFVzZWQgaWYgdGhlIHVybCBpcyBlbXB0eSBvciBcImJhY2tcIiBkb2VzIG5vdCBleGlzdC5cbiAqL1xucmVzcG9uc2UucmVmcmVzaCA9IGZ1bmN0aW9uIHJlZnJlc2ggKGRlbGF5LCB1cmwsIGFsdCkge1xuICB2YXIgcmVxID0gdGhpcy5jdHgucmVxXG5cbiAgZGVsYXkgPSBkZWxheSB8fCAwXG4gIC8vIEJhY2sgdXNlcyByZXF1ZXN0IHJlZmVycmVyIGhlYWRlciBhcyBhIHVybC5cbiAgdXJsID0gKHVybCA9PT0gJ2JhY2snKSA/IHJlcS5nZXQoJ1JlZmVycmVyJykgOiB1cmxcbiAgLy8gRGVmYXVsdCB1cmwgdG8gYWx0ZXJuYXRpdmUuXG4gIHVybCA9IHVybCB8fCBhbHQgfHwgcmVxLmhyZWZcblxuICB0aGlzLnNldCgnUmVmcmVzaCcsIGRlbGF5ICsgJzsgdXJsPScgKyBVUkwucmVzb2x2ZShyZXEuaHJlZiwgdXJsKSlcbn1cblxuLyoqXG4gKiBVdGlsaXR5IHRvIHJldHJpZXZlIGEgaGVhZGVyIGZvciB0aGUgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGZpZWxkXG4gKiBAcmV0dXJuIHtBcnJheXxTdHJpbmd9XG4gKi9cbnJlc3BvbnNlLmdldCA9IGZ1bmN0aW9uIGdldCAoZmllbGQpIHtcbiAgcmV0dXJuIHRoaXMuaGVhZGVyc1t0b0ZpZWxkKGZpZWxkKV1cbn1cblxuLyoqXG4gKiBVdGlsaXR5IHRvIHNldCBhIGhlYWRlciBmb3IgdGhlIHJlc3BvbnNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWVsZFxuICogQHBhcmFtIHtBcnJheXxTdHJpbmd9IHZhbFxuICovXG5yZXNwb25zZS5zZXQgPSBmdW5jdGlvbiBzZXQgKGZpZWxkLCB2YWwpIHtcbiAgdGhpcy5oZWFkZXJzW3RvRmllbGQoZmllbGQpXSA9IHZhbFxufVxuXG4vKipcbiAqIFV0aWxpdHkgdG8gYXBwZW5kIHRvIGFuIGV4aXN0aW5nIGhlYWRlciBmb3IgdGhlIHJlc3BvbnNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBmaWVsZFxuICogQHBhcmFtIHtBcnJheXxTdHJpbmd9IHZhbFxuICovXG5yZXNwb25zZS5hcHBlbmQgPSBmdW5jdGlvbiBhcHBlbmQgKGZpZWxkLCB2YWwpIHtcbiAgZmllbGQgPSB0b0ZpZWxkKGZpZWxkKVxuICB2YXIgaGVhZGVycyA9IHRoaXMuaGVhZGVyc1xuICB2YXIgY3VyID0gdGhpcy5oZWFkZXJzW2ZpZWxkXVxuXG4gIGlmIChjdXIgPT0gbnVsbCkgY3VyID0gW11cbiAgZWxzZSBpZiAoIUFycmF5LmlzQXJyYXkoY3VyKSkgY3VyID0gW2N1cl1cblxuICBoZWFkZXJzW2ZpZWxkXSA9IGN1ci5jb25jYXQodmFsKVxufVxuXG4vKipcbiAqIFV0aWxpdHkgdG8gZGVsZXRlIGFuIGV4aXN0aW5nIGhlYWRlciBvbiB0aGUgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGZpZWxkXG4gKi9cbnJlc3BvbnNlLnJlbW92ZSA9IGZ1bmN0aW9uIHJlbW92ZSAoZmllbGQpIHtcbiAgZGVsZXRlIHRoaXMuaGVhZGVyc1t0b0ZpZWxkKGZpZWxkKV1cbn1cbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgXCIxMDBcIjogXCJDb250aW51ZVwiLFxuICBcIjEwMVwiOiBcIlN3aXRjaGluZyBQcm90b2NvbHNcIixcbiAgXCIxMDJcIjogXCJQcm9jZXNzaW5nXCIsXG4gIFwiMjAwXCI6IFwiT0tcIixcbiAgXCIyMDFcIjogXCJDcmVhdGVkXCIsXG4gIFwiMjAyXCI6IFwiQWNjZXB0ZWRcIixcbiAgXCIyMDNcIjogXCJOb24tQXV0aG9yaXRhdGl2ZSBJbmZvcm1hdGlvblwiLFxuICBcIjIwNFwiOiBcIk5vIENvbnRlbnRcIixcbiAgXCIyMDVcIjogXCJSZXNldCBDb250ZW50XCIsXG4gIFwiMjA2XCI6IFwiUGFydGlhbCBDb250ZW50XCIsXG4gIFwiMjA3XCI6IFwiTXVsdGktU3RhdHVzXCIsXG4gIFwiMjA4XCI6IFwiQWxyZWFkeSBSZXBvcnRlZFwiLFxuICBcIjIyNlwiOiBcIklNIFVzZWRcIixcbiAgXCIzMDBcIjogXCJNdWx0aXBsZSBDaG9pY2VzXCIsXG4gIFwiMzAxXCI6IFwiTW92ZWQgUGVybWFuZW50bHlcIixcbiAgXCIzMDJcIjogXCJGb3VuZFwiLFxuICBcIjMwM1wiOiBcIlNlZSBPdGhlclwiLFxuICBcIjMwNFwiOiBcIk5vdCBNb2RpZmllZFwiLFxuICBcIjMwNVwiOiBcIlVzZSBQcm94eVwiLFxuICBcIjMwNlwiOiBcIihVbnVzZWQpXCIsXG4gIFwiMzA3XCI6IFwiVGVtcG9yYXJ5IFJlZGlyZWN0XCIsXG4gIFwiMzA4XCI6IFwiUGVybWFuZW50IFJlZGlyZWN0XCIsXG4gIFwiNDAwXCI6IFwiQmFkIFJlcXVlc3RcIixcbiAgXCI0MDFcIjogXCJVbmF1dGhvcml6ZWRcIixcbiAgXCI0MDJcIjogXCJQYXltZW50IFJlcXVpcmVkXCIsXG4gIFwiNDAzXCI6IFwiRm9yYmlkZGVuXCIsXG4gIFwiNDA0XCI6IFwiTm90IEZvdW5kXCIsXG4gIFwiNDA1XCI6IFwiTWV0aG9kIE5vdCBBbGxvd2VkXCIsXG4gIFwiNDA2XCI6IFwiTm90IEFjY2VwdGFibGVcIixcbiAgXCI0MDdcIjogXCJQcm94eSBBdXRoZW50aWNhdGlvbiBSZXF1aXJlZFwiLFxuICBcIjQwOFwiOiBcIlJlcXVlc3QgVGltZW91dFwiLFxuICBcIjQwOVwiOiBcIkNvbmZsaWN0XCIsXG4gIFwiNDEwXCI6IFwiR29uZVwiLFxuICBcIjQxMVwiOiBcIkxlbmd0aCBSZXF1aXJlZFwiLFxuICBcIjQxMlwiOiBcIlByZWNvbmRpdGlvbiBGYWlsZWRcIixcbiAgXCI0MTNcIjogXCJQYXlsb2FkIFRvbyBMYXJnZVwiLFxuICBcIjQxNFwiOiBcIlVSSSBUb28gTG9uZ1wiLFxuICBcIjQxNVwiOiBcIlVuc3VwcG9ydGVkIE1lZGlhIFR5cGVcIixcbiAgXCI0MTZcIjogXCJSYW5nZSBOb3QgU2F0aXNmaWFibGVcIixcbiAgXCI0MTdcIjogXCJFeHBlY3RhdGlvbiBGYWlsZWRcIixcbiAgXCI0MThcIjogXCJJJ20gYSB0ZWFwb3RcIixcbiAgXCI0MjFcIjogXCJNaXNkaXJlY3RlZCBSZXF1ZXN0XCIsXG4gIFwiNDIyXCI6IFwiVW5wcm9jZXNzYWJsZSBFbnRpdHlcIixcbiAgXCI0MjNcIjogXCJMb2NrZWRcIixcbiAgXCI0MjRcIjogXCJGYWlsZWQgRGVwZW5kZW5jeVwiLFxuICBcIjQyNVwiOiBcIlVub3JkZXJlZCBDb2xsZWN0aW9uXCIsXG4gIFwiNDI2XCI6IFwiVXBncmFkZSBSZXF1aXJlZFwiLFxuICBcIjQyOFwiOiBcIlByZWNvbmRpdGlvbiBSZXF1aXJlZFwiLFxuICBcIjQyOVwiOiBcIlRvbyBNYW55IFJlcXVlc3RzXCIsXG4gIFwiNDMxXCI6IFwiUmVxdWVzdCBIZWFkZXIgRmllbGRzIFRvbyBMYXJnZVwiLFxuICBcIjQ1MVwiOiBcIlVuYXZhaWxhYmxlIEZvciBMZWdhbCBSZWFzb25zXCIsXG4gIFwiNTAwXCI6IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCIsXG4gIFwiNTAxXCI6IFwiTm90IEltcGxlbWVudGVkXCIsXG4gIFwiNTAyXCI6IFwiQmFkIEdhdGV3YXlcIixcbiAgXCI1MDNcIjogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gIFwiNTA0XCI6IFwiR2F0ZXdheSBUaW1lb3V0XCIsXG4gIFwiNTA1XCI6IFwiSFRUUCBWZXJzaW9uIE5vdCBTdXBwb3J0ZWRcIixcbiAgXCI1MDZcIjogXCJWYXJpYW50IEFsc28gTmVnb3RpYXRlc1wiLFxuICBcIjUwN1wiOiBcIkluc3VmZmljaWVudCBTdG9yYWdlXCIsXG4gIFwiNTA4XCI6IFwiTG9vcCBEZXRlY3RlZFwiLFxuICBcIjUwOVwiOiBcIkJhbmR3aWR0aCBMaW1pdCBFeGNlZWRlZFwiLFxuICBcIjUxMFwiOiBcIk5vdCBFeHRlbmRlZFwiLFxuICBcIjUxMVwiOiBcIk5ldHdvcmsgQXV0aGVudGljYXRpb24gUmVxdWlyZWRcIlxufSIsIi8qIVxuICogc3RhdHVzZXNcbiAqIENvcHlyaWdodChjKSAyMDE0IEpvbmF0aGFuIE9uZ1xuICogQ29weXJpZ2h0KGMpIDIwMTYgRG91Z2xhcyBDaHJpc3RvcGhlciBXaWxzb25cbiAqIE1JVCBMaWNlbnNlZFxuICovXG5cbid1c2Ugc3RyaWN0J1xuXG4vKipcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKiBAcHJpdmF0ZVxuICovXG5cbnZhciBjb2RlcyA9IHJlcXVpcmUoJy4vY29kZXMuanNvbicpXG5cbi8qKlxuICogTW9kdWxlIGV4cG9ydHMuXG4gKiBAcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBzdGF0dXNcblxuLy8gYXJyYXkgb2Ygc3RhdHVzIGNvZGVzXG5zdGF0dXMuY29kZXMgPSBwb3B1bGF0ZVN0YXR1c2VzTWFwKHN0YXR1cywgY29kZXMpXG5cbi8vIHN0YXR1cyBjb2RlcyBmb3IgcmVkaXJlY3RzXG5zdGF0dXMucmVkaXJlY3QgPSB7XG4gIDMwMDogdHJ1ZSxcbiAgMzAxOiB0cnVlLFxuICAzMDI6IHRydWUsXG4gIDMwMzogdHJ1ZSxcbiAgMzA1OiB0cnVlLFxuICAzMDc6IHRydWUsXG4gIDMwODogdHJ1ZVxufVxuXG4vLyBzdGF0dXMgY29kZXMgZm9yIGVtcHR5IGJvZGllc1xuc3RhdHVzLmVtcHR5ID0ge1xuICAyMDQ6IHRydWUsXG4gIDIwNTogdHJ1ZSxcbiAgMzA0OiB0cnVlXG59XG5cbi8vIHN0YXR1cyBjb2RlcyBmb3Igd2hlbiB5b3Ugc2hvdWxkIHJldHJ5IHRoZSByZXF1ZXN0XG5zdGF0dXMucmV0cnkgPSB7XG4gIDUwMjogdHJ1ZSxcbiAgNTAzOiB0cnVlLFxuICA1MDQ6IHRydWVcbn1cblxuLyoqXG4gKiBQb3B1bGF0ZSB0aGUgc3RhdHVzZXMgbWFwIGZvciBnaXZlbiBjb2Rlcy5cbiAqIEBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gcG9wdWxhdGVTdGF0dXNlc01hcCAoc3RhdHVzZXMsIGNvZGVzKSB7XG4gIHZhciBhcnIgPSBbXVxuXG4gIE9iamVjdC5rZXlzKGNvZGVzKS5mb3JFYWNoKGZ1bmN0aW9uIGZvckVhY2hDb2RlIChjb2RlKSB7XG4gICAgdmFyIG1lc3NhZ2UgPSBjb2Rlc1tjb2RlXVxuICAgIHZhciBzdGF0dXMgPSBOdW1iZXIoY29kZSlcblxuICAgIC8vIFBvcHVsYXRlIHByb3BlcnRpZXNcbiAgICBzdGF0dXNlc1tzdGF0dXNdID0gbWVzc2FnZVxuICAgIHN0YXR1c2VzW21lc3NhZ2VdID0gc3RhdHVzXG4gICAgc3RhdHVzZXNbbWVzc2FnZS50b0xvd2VyQ2FzZSgpXSA9IHN0YXR1c1xuXG4gICAgLy8gQWRkIHRvIGFycmF5XG4gICAgYXJyLnB1c2goc3RhdHVzKVxuICB9KVxuXG4gIHJldHVybiBhcnJcbn1cblxuLyoqXG4gKiBHZXQgdGhlIHN0YXR1cyBjb2RlLlxuICpcbiAqIEdpdmVuIGEgbnVtYmVyLCB0aGlzIHdpbGwgdGhyb3cgaWYgaXQgaXMgbm90IGEga25vd24gc3RhdHVzXG4gKiBjb2RlLCBvdGhlcndpc2UgdGhlIGNvZGUgd2lsbCBiZSByZXR1cm5lZC4gR2l2ZW4gYSBzdHJpbmcsXG4gKiB0aGUgc3RyaW5nIHdpbGwgYmUgcGFyc2VkIGZvciBhIG51bWJlciBhbmQgcmV0dXJuIHRoZSBjb2RlXG4gKiBpZiB2YWxpZCwgb3RoZXJ3aXNlIHdpbGwgbG9va3VwIHRoZSBjb2RlIGFzc3VtaW5nIHRoaXMgaXNcbiAqIHRoZSBzdGF0dXMgbWVzc2FnZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IGNvZGVcbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKiBAcHVibGljXG4gKi9cblxuZnVuY3Rpb24gc3RhdHVzIChjb2RlKSB7XG4gIGlmICh0eXBlb2YgY29kZSA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAoIXN0YXR1c1tjb2RlXSkgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHN0YXR1cyBjb2RlOiAnICsgY29kZSlcbiAgICByZXR1cm4gY29kZVxuICB9XG5cbiAgaWYgKHR5cGVvZiBjb2RlICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NvZGUgbXVzdCBiZSBhIG51bWJlciBvciBzdHJpbmcnKVxuICB9XG5cbiAgLy8gJzQwMydcbiAgdmFyIG4gPSBwYXJzZUludChjb2RlLCAxMClcbiAgaWYgKCFpc05hTihuKSkge1xuICAgIGlmICghc3RhdHVzW25dKSB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc3RhdHVzIGNvZGU6ICcgKyBuKVxuICAgIHJldHVybiBuXG4gIH1cblxuICBuID0gc3RhdHVzW2NvZGUudG9Mb3dlckNhc2UoKV1cbiAgaWYgKCFuKSB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc3RhdHVzIG1lc3NhZ2U6IFwiJyArIGNvZGUgKyAnXCInKVxuICByZXR1cm4gblxufVxuIl19
