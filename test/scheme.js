var assert = require('core-assert'),
    json = require('nano-json'),
    timer = require('nano-timer'),
    fs = require('nano-fs');


function uni_test(fn, sradix, dradix, args, ret) {
	test(fn.name+'('+json.js2str(args, sradix)+') -> '+json.js2str(ret, dradix)+'', function (done) {
		assert.deepStrictEqual(args instanceof Array ? fn.apply(null, args) : fn.call(null, args), ret);
		done();
	});
}

function massive(name, fn, pairs, sradix, dradix) {
	suite(name, function () {
		for (var i = 0, n = pairs.length; i < n; i += 2)
			uni_test(fn, sradix, dradix, pairs[i], pairs[i+1]);
	});
}

function fail_test(fn, sradix, dradix, args, ret) {
	test(fn.name+'('+json.js2str(args, sradix)+') -> '+json.js2str(ret.name, dradix)+'', function (done) {
		assert.throws(function () {
			if (args instanceof Array)
				fn.apply(null, args);
			else
				fn.call(null, args);
		}, ret);
		done();
	});
}

function massive_fails(name, fn, pairs, sradix, dradix) {
	suite(name, function () {
		for (var i = 0, n = pairs.length; i < n; i += 2)
			fail_test(fn, sradix, dradix, pairs[i], pairs[i+1]);
	});
}

var ui_parser = require('nano-ui-parser'),
    UiScheme = require('../index.js');

suite('parsing', function () {

	var lexemes = {
		ID: /[A-Z_][A-Z0-9_-]*|/g,
		TAGS: /[a-zA-Z0-9_-]+(?:\s*\|\s*[a-zA-Z0-9_-]+)*|/g,
		SP: /\s+|/g,
		ANY: /.+/g,
		LEXIDS: /[A-Z0-9_-]+(?:\s*\|\s*[A-Z0-9_-]+)*|/g
	};

	test('basic ui toString', function (done) {
		fs.readFile('test/scheme-scheme.ui', 'utf8')
			.then(function (ui_text) {
				var ui = ui_parser(ui_text),
				    scheme = new UiScheme(ui);
				//console.log(json.render(scheme));
				done();
			}).catch(done);
	});

	function scheme_check(ui_text) {
		var ui = ui_parser(ui_text),
		    scheme = new UiScheme(ui);
		return 1;
	}

	massive('scheme compiling', scheme_check, [
		'', 1,
		'root-rule ogo', 1,
		'lex O 1', 1,
		'lex O 1\nroot-rule top|ww\nrule top O\n\trule sub O', 1,
		'rule oo', 1
	]);

	massive_fails('scheme compiling fails', scheme_check, [
		null, TypeError,
		'o', SyntaxError,
		'lex', SyntaxError,
		'lex {}', SyntaxError,
		'lex ID', SyntaxError,
		'lex ID ', SyntaxError,
		'root-rule', SyntaxError,
		'root-rule {}', SyntaxError,
		'root-rule ogo sp', SyntaxError,
		'root-rule ogo\n\tnot\n', SyntaxError
	]);
});

suite('schemes validation', function () {

	var tests = [
		[ '', // empty schema
			[ '' ], // correct ui
			[ 'e' ] // bad ui text
		],
		[ 'root-rule node',
			[ '', 'node' ],
			[ 'o' ]
		],
		[ 'lex ID [a-z][a-z0-9]+\nroot-rule node ID',
			[ '', 'node erer' ],
			[ 'o', 'node', 'node @#@' ]
		],
		[ 'lex ID [a-z][a-z0-9]+\nroot-rule node ID\nrule node ID',
			[ '', 'node erer' ],
			[ 'o', 'node', 'node @#@' ]
		],
		[ '\
lex ID [A-Za-z][A-Za-z0-9_-]+\n\
lex SP \\s+\n\
lex ANY .+\n\
root-rule menu\n\
rule menu\n\
	rule group|page\n\
rule group ID\n\
	rule page\n\
rule page ID\n\
	rule module ID\n\
',
			[ '', '\n\
menu\n\
\n', '\
menu\n\
	group id\n\
		page ooo\n\
	page jj-e\n\
', '\
menu\n\
	group er\n\
		page sf\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		module wr23r4\n\
' ],
			[ 'o', 'node', '\
menu\n\
	group id\n\
		page\n\
	page jj-e\n\
', '\
menu\n\
	group id\n\
		page ooo\n\
	page jj-e\n\
page erer\n\
',, '\
menu\n\
	group er\n\
		page @#$\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		module wr23r4\n\
', '\
menu\n\
	group er\n\
		module re\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		module wr23r4\n\
', '\
menu\n\
	group er\n\
		page er\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		group wr23r4\n\
', '\
menu\n\
	group er\n\
		page er\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		goup wr23r4\n\
' ]
		], [ '\
lex ID [A-Za-z][A-Za-z0-9_-]+\n\
lex SP \\s+\n\
lex VALUE \\S+\n\
lex ANY .+\n\
root-rule form (ID (SP ANY)?)?\n\
rule form\n\
	rule text|ip|table ID (SP ANY)?\n\
rule table ID\n\
	rule text|ip ID SP VALUE (SP ANY)?\n\
',
			[ '', '\n\
form\n\
\n', '\
form\n\
	text id { op:1 }\n\
	ip oo\n\
', '\
form\n\
	text id { op:1 }\n\
	ip oo\n\
	table opop\n\
		text name 45545 { o:! }\n\
		ip add 2323\n\
	ip dffdf 3424\n\
' ],
			[ 'o', 'node', '\
menu\n\
	group id\n\
		page\n\
	page jj-e\n\
', '\
menu\n\
	group id\n\
		page ooo\n\
	page jj-e\n\
page erer\n\
',, '\
menu\n\
	group er\n\
		page @#$\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		module wr23r4\n\
', '\
menu\n\
	group er\n\
		module re\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		module wr23r4\n\
', '\
menu\n\
	group er\n\
		page er\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		group wr23r4\n\
', '\
menu\n\
	group er\n\
		page er\n\
			module sdf\n\
		page Aff\n\
	page ERE\n\
		goup wr23r4\n\
' ]
		]
	];

	tests.forEach(function (variant) {
		var scheme_text = variant[0],
		    goods = variant[1],
		    fails = variant[2];

		var scheme = new UiScheme(ui_parser(scheme_text));

		suite(json.str2str(scheme_text), function () {
			suite('successes', function () {
				goods.forEach(function (ui_text) {
					test(json.str2str(ui_text), function (done) {
						var ui = ui_parser(ui_text);
						try {
							scheme.validate(ui);
							done();
						} catch (e) {
							done(e);
						}
					});
				});
			});
    
			suite('fails', function () {
				fails.forEach(function (ui_text) {
					test(json.str2str(ui_text), function (done) {
						var ui = ui_parser(ui_text);
						try {
							scheme.validate(ui);
							done(Error('not failed'));
						} catch (e) {
							done();
						}
					});
				});
			});
		});
	});

});
