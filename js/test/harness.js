/**
 * Harness for test module use
 */
var Harness = {

	ACTION_NAV_REG : 'nav.register',
	EVT_FRAGS_BHTTP : 'beforehttp.thx.frags',
	EVT_FRAG_BHTTP : 'beforehttp.thx.frag',
	EVT_FRAG_BDOM : 'beforedom.thx.frag',
	EVT_FRAG_ADOM : 'afterdom.thx.frag',
	EVT_FRAG_LOAD : 'load.thx.frag',
	EVT_FRAGS_LOAD : 'load.thx.frags',
	TEST_CSS_CLASS : 'qunit',
	TEST_FIXTURE_SEL : '#qunit-fixture',
	REGEX_PARAMS_STR : /([^&=]+)=([^&]*)/g,

	/**
	 * A convenience construct for framework/test related tasks
	 * 
	 * @constructor
	 */
	Test : function() {
		var $$ = this;
		$$.eventCount = 0;

		/**
		 * Creates a descriptive representation of the specified event
		 * 
		 * @param evt
		 *            the event object
		 * @param act
		 *            the alternative action to use when the event does not have
		 *            an action property
		 * @returns the description
		 */
		function desc(evt, act) {
			var ea = act ? act : evt.action;
			return (typeof evt === 'string' ? evt : evt.type
					+ (evt.namespace ? '.' + evt.namespace : ''))
					+ (ea ? ' (for action ' + ea + ')' : '');
		}

		/**
		 * Listens for the specified events, logs them to the UI and prevents
		 * further processing when an event contains an error
		 * 
		 * @param n
		 *            the node(s) the event will be listened on
		 * @param evt
		 *            the event name to listen for with regards to the callback
		 *            function
		 * @param cb
		 *            the callback function that will be called when an event is
		 *            received
		 * @param noIgnoreHttp405
		 *            true to fail when an HTTP 405 (Method not supported) is
		 *            received
		 */
		function listen(n, evt, cb, noIgnoreHttp405) {
			n.on(evt, function(event) {
				Harness.ok(true, desc(event), '#' + ++$$.eventCount
						+ 'Event received');
				if ((typeof cb === 'undefined' || cb != true) && event.error) {
					if (event.error.statusCode == 405) {
						if (!QUnit.config.current.evtWarns) {
							QUnit.config.current.evtWarns = 1;
						} else {
							QUnit.config.current.evtWarns++;
						}
						Harness.ok('warn', event.error);
					} else {
						Harness.ok(false, event.error);
					}
					start();
				} else if (typeof cb === 'function') {
					cb(event);
				}
			});
		}

		/**
		 * Listens for all incoming framework events, logs them to the UI and
		 * prevents further processing when an event contains an error
		 * 
		 * @param n
		 *            the node(s) the event will be listened on
		 * @param evt
		 *            the event name to listen for with regards to the callback
		 *            function
		 * @param cb
		 *            the callback function that will be called when an event is
		 *            received
		 * @param noIgnoreHttp405
		 *            true to fail when an HTTP 405 (Method not supported) is
		 *            received
		 */
		function listenAll(n, evt, cb, noIgnoreHttp405) {
			var ihe = false;
			var ucb = false;
			for (var i = 0; i < Harness.EVTS.length; i++) {
				ucb = Harness.EVTS[i] == evt;
				if (!ihe) {
					ihe = ucb;
				}
				listen(n, Harness.EVTS[i], ucb ? cb : i == 0 ? true : false,
						noIgnoreHttp405);
			}
			if (!ihe) {
				listen(n, evt, null, cb, noIgnoreHttp405);
			}
		}

		/**
		 * Registers and optionally executes navigational tests
		 * 
		 * @param html
		 *            the HTML or DOM element(s) to test
		 * @param fx
		 *            the listener for the test event
		 * @param uevt
		 *            the user event to trigger
		 * @param tevt
		 *            the test event to listen for
		 * @param iframeId
		 *            when present, an in-line frame will be created using the
		 *            supplied ID and the specified HTML will be appended to
		 *            it's body
		 * @param noInvoke
		 *            true to prevent invocation of user event trigger
		 * @param noIgnoreHttp405
		 *            true to fail when an HTTP 405 (Method not supported) is
		 *            received
		 */
		$$.asyncNavRegister = function(html, fx, uevt, tevt, iframeId,
				noInvoke, noIgnoreHttp405) {
			var p = $(html);
			var doc = iframeId ? Harness.addIframe(iframeId, p).contents()
					: document;
			var n = Harness.testSelect(p, '.' + Harness.TEST_CSS_CLASS);
			if (n.length <= 0) {
				Harness.ok(false, 'Unable to find .' + Harness.TEST_CSS_CLASS);
				start();
				return n;
			}
			// need to pass scope for elements that are not attached to the DOM
			var a = $.contains(document, p[0]) ? Harness.ACTION_NAV_REG : {
				action : Harness.ACTION_NAV_REG,
				actionScope : p,
				searchScope : p,
				destScope : p
			};
			p.thymus(a);
			Harness.ok(true, Harness.ACTION_NAV_REG, 'Action executed');
			if (uevt) {
				if (typeof fx === 'function') {
					tevt = tevt ? tevt : uevt;
					listenAll(n, tevt, function(event) {
						try {
							fx(event, doc);
						} catch (e) {
							Harness.ok(false, e);
						}
						start();
					});
				}
				if (!noInvoke) {
					n.trigger(uevt);
					Harness.ok(true, uevt, 'Event triggered');
				}
			}
			return n;
		};
		$$.destroy = function() {
			if (!QUnit.config.current.evtWarns
					&& $$.eventCount != Harness.EVTS.length) {
				Harness.ok(false, 'Expected "' + Harness.EVTS.length
						+ '" framework events, but received "' + $$.eventCount
						+ '"');
			}
		};
	},

	/**
	 * An extension to the QUnit counterpart that takes additional formatting
	 * options as well as takes into account if HTML contents should be shown
	 * 
	 * @param state
	 *            the assertion state (a value of <code>null</code> will only
	 *            be asserted when the global option verbose is turned on)
	 * @param msg
	 *            the message passed to the assertion
	 * @param pp
	 *            an optional prepender text
	 * @param el
	 *            an optional element to show HTML for (when global option
	 *            verbose is turned on)
	 */
	ok : function(state, msg, pp, el) {
		if (state == null && !QUnit.urlParams.verbose) {
			return;
		}
		var isWarn = state == 'warn';
		state = state == null ? true : isWarn ? true : state;
		var ise = msg instanceof Error && msg.stack;
		var nm = null, wm = null;
		if (ise) {
			if (isWarn) {
				nm = msg.message;
				wm = msg.stack.replace(msg.message, '');
				wm = 'Warning: \n' + msg.message + '\n' + wm;
			} else {
				nm = msg.stack.replace(msg.message, '');
				nm = msg.message + '\n' + nm;
			}
		} else if (pp) {
			nm = pp + ': ' + msg;
		} else {
			nm = msg;
		}
		if (el && QUnit.urlParams.verbose) {
			nm += '... ' + (el instanceof jQuery ? el.html() : el);
		}
		ok(state, nm);
		if (isWarn) {
			var $wn = $('<pre style="color: #8a6d3b;background-color: #fcf8e3;border-color: #faebcc;">'
					+ wm + '</pre>');
			var id = QUnit.config.current.id;
			var tnum = QUnit.config.current.testNumber;
			var tname = QUnit.config.current.testName;
			// testDone(function(details) {
			testDone(function(details) {
				if (details.name !== tname) {
					return;
				}
				var $t = $('#' + id);
				var $li = $t.find('.qunit-assert-list > li:nth-child(' + tnum
						+ ')');
				$li.attr('style', function(i, s) {
					return s + 'border-left-color: #FFFF99 !important;';
				});
				$li.append($wn);
				if (details.failed <= 0) {
					$t.css('background-color', '#FFFF99');
				}
			});
		}
	},

	/**
	 * Creates a test selection that will find or filter in one step
	 * 
	 * @param el
	 *            the node to select from
	 * @param sel
	 *            the selector to use
	 * @returns the selection
	 */
	testSelect : function(el, sel) {
		return el.length == 1 && el.hasClass(Harness.TEST_CSS_CLASS) ? el
				: el.length > 1 ? el.filter(sel) : el.find(sel);
	},

	/**
	 * Generates an associative array with key as the parameter name and values
	 * as and array of found values
	 * 
	 * @param o
	 *            either the URL encoded string of parameters or a window to get
	 *            the search parameters (defaults to the current windows search
	 *            parameters)
	 * @returns an object that contains an associative array of parameters
	 *          "params" and a count of found parameters "cnt"
	 */
	getParams : function(o) {
		var s = typeof o === 'string' ? o
				: typeof o === 'object' && o.document ? o.document.location.search
						: window.location.search;
		var t = s.indexOf('?');
		if (t >= 0 && t < (s.length - 1)) {
			s = s.substr(t + 1);
		}
		var ss = s.match(Harness.REGEX_PARAMS_STR);
		var il = ss.length - 1, p = null, oa = [];
		for (var i = 0; i <= il; i++) {
			p = ss[i];
			if (i == il) {
				// remove possible hashes
				t = p.split('#');
				if (t > 1) {
					p.pop();
					p = p.join('#');
				}
			}
			t = p.indexOf('=');
			var k = decodeURIComponent(p.substr(0, t));
			var v = decodeURIComponent((p.length - 1) == t ? '' : p
					.substr(t + 1));
			if (!oa[k]) {
				oa[k] = {
					vals : []
				};
			}
			oa[k].vals.push(v);
		}
		return {
			params : oa,
			cnt : il + 1
		};
	},

	/**
	 * Data construct used for common testing tasks that simplify validation of
	 * such things as passed parameters
	 * 
	 * @constructor
	 * @param html
	 *            initial HTML
	 */
	Data : function(html) {
		function Params() {
			this.pa = [];
			this.cnt = 0;
		}
		var $$ = this;
		$$.html = html;
		var pp = 'HTTP Parameters', outParams = new Params(), noOutParams = new Params(), cnt = 0;
		$$.keyVal = function(v, x, useLastKey, va, na) {
			var k = 'param' + (useLastKey ? cnt : ++cnt);
			var p = x ? noOutParams : outParams;
			if (!useLastKey) {
				p.cnt++;
			}
			if (!p.pa[k]) {
				p.pa[k] = {
					vals : [],
					hasSameVals : function(ovals) {
						return $(this.vals).not(ovals).length == 0
								&& $(ovals).not(this.vals).length == 0;
					},
					chkVals : function(ovals, exclude) {
						if (!ovals || ovals.length <= 0) {
							return exclude ? true : false;
						}
						var io = 0;
						for (var i = 0; i < this.vals.length; i++) {
							io = ovals.indexOf(this.vals[i]);
							if ((!exclude && io == -1) || (exclude && io > -1)) {
								return false;
							}
						}
						return true;
					}
				};
			}
			if (v) {
				p.pa[k].vals.push(typeof v === 'string' ? v : v.toString());
			}
			p.pa[k].key = k;
			return (k && !useLastKey ? (na ? ' ' + na : ' name') + '="' + k
					+ '" ' : '')
					+ (v ? (va ? va == ' ' ? v : ' ' + va + '="' + v + '" '
							: ' value="' + v + '" ') : '');
		};
		$$.validate = function(incomingParams, strict) {
			Harness.ok(true, 'Validating incoming', pp, incomingParams);
			var ips = Harness.getParams(incomingParams);
			// ensure we have the same amount of incoming parameters as we do
			// parameters that were submitted
			if ((strict && ips.cnt != outParams.cnt)
					|| (!strict && ips.cnt < outParams.cnt)) {
				Harness.ok(false, 'Expected ' + outParams.cnt + ', but found '
						+ ips.cnt, pp);
			}
			var op = null, ip = null;
			// verify parameters that should be present are indeed present
			for ( var i in outParams.pa) {
				op = outParams.pa[i];
				ip = ips.params[op.key];
				if (!ip) {
					Harness.ok(false, 'Unable to find "' + op.key
							+ '" with a value(s) "' + op.vals.join(',') + '"',
							pp);
				} else {
					if (op.chkVals(ip.vals)) {
						Harness.ok(true, 'Incoming "' + op.key
								+ '" found with a value(s) "'
								+ ip.vals.join(',')
								+ '" and contain all of the '
								+ 'expected outgoing value(s) "'
								+ op.vals.join(',') + '"', pp);
					} else {
						Harness.ok(false, 'Incoming "' + op.key
								+ '" with a value(s) "' + ip.vals.join(',')
								+ '" does not contain some/all '
								+ 'of the expected outgoing value(s) "'
								+ op.vals.join(',') + '"', pp);
					}
				}
			}
			// verify parameters that should have been excluded
			for ( var i in noOutParams.pa) {
				op = noOutParams.pa[i];
				ip = ips.params[op.key];
				// incoming parameter is present
				if (ip && !op.chkVals(ip.vals, true)) {
					Harness.ok(false, 'Incoming "' + op.key
							+ '" found with a value(s) "' + ip.vals.join(',')
							+ '", but should have been excluded '
							+ 'from outgoing value(s) "' + op.vals.join(',')
							+ '"', pp);
				} else {
					Harness.ok(true, (ip ? 'Incoming "' + op.key
							+ '" with a value(s) "' + ip.vals.join(',')
							: 'Outgoing "' + op.key)
							+ '" verified not to contain the '
							+ 'excluded value(s) "' + op.vals.join(',') + '"',
							pp);
				}
			}
		};
	},

	/**
	 * Adds an in-line frame to the test fixture
	 * 
	 * @param id
	 *            the ID applied to the in-line frame
	 * @param html
	 *            optional HTML content or node(s) to append to the created
	 *            in-line frame document
	 * @returns the in-line frame
	 */
	addIframe : function(id, html) {
		var $i = $('<iframe id="'
				+ id
				+ '" name="'
				+ id
				+ '" width="100%" height="215" frameborder="0" scrolling="yes" '
				+ 'marginheight="0" marginwidth="0" src="about:blank"> </iframe>');
		var $win = null;
		function wr() {
			var $w = $(this).contents();
			$w[0]
					.write('<!doctype html><html><head></head><body></body></html>');
			if (html) {
				$w.find('body').append(html);
			}
			$win = $win ? $win.add($w) : $w;
		}
		$i.appendTo(Harness.TEST_FIXTURE_SEL).each(wr);
		return $win;
	},

	/**
	 * @returns a randomly generated in-line frame ID
	 */
	generateIframeId : function() {
		return 'qunitFrame' + Math.floor((Math.random() * 10000) + 1);
	},

	/**
	 * Initializes the test harness
	 */
	init : function() {
		Harness.EVTS = [ Harness.EVT_FRAGS_BHTTP, Harness.EVT_FRAG_BHTTP,
				Harness.EVT_FRAG_BDOM, Harness.EVT_FRAG_ADOM,
				Harness.EVT_FRAG_LOAD, Harness.EVT_FRAGS_LOAD ];
		// See
		// https://github.com/axemclion/grunt-saucelabs#test-result-details-with-qunit
		QUnit.done(function(results) {
			window.global_test_results = results;
		});
		QUnit.config.testTimeout = 30000;
		/*
		 * QUnit.config.autostart = false; function init(event) { QUnit.start(); }
		 */
		QUnit.config.urlConfig
				.push({
					id : 'verbose',
					label : 'Verbose',
					tooltip : 'Show extended information such as HTML result content for each individual test (that supports this feature).'
				});
	}
};
Harness.init();