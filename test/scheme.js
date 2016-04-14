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
				assert.strictEqual(scheme.toString(), "\
lex LEXIDS ([A-Za-z0-9_-]+(?:\\s*\\|\\s*[A-Za-z0-9_-]+)*)\n\
lex DEFID ([A-Za-z0-9_-]+)\n\
lex TAGS ([a-zA-Z0-9_-]+(?:\\s*\\|\\s*[a-zA-Z0-9_-]+)*)\n\
lex CHILDREN ([a-zA-Z0-9_-]+(?:\\s*\\|\\s*[a-zA-Z0-9_-]+)*)\n\
lex SP \\s+\n\
lex ARGUMENTS (.+)\n\
lex ANY (.+)\n\
\n\
rule lex LEXIDS SP ARGUMENTS\n\
\n\
rule def DEFID\n\
	rule seq ANY\n\
	rule case TAGS SP ANY\n\
\n\
rule rule TAGS SP ARGUMENTS\n\
	rule rule\n\
	rule children TAGS\n\
\n\
root-rule lex|root-rule|rule|def\n\
");
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
		'lex ID a\n\tchild', Error,
		'root-rule', SyntaxError,
		'root-rule {}', SyntaxError,
		'root-rule ogo sp', SyntaxError,
		'def\nerere\n', SyntaxError,
		'def >\nerere\n', SyntaxError,
		'def erer {}\nerere\n', SyntaxError,
		'def erer\nerere\n', SyntaxError,
		'def erer\n\terer\n', SyntaxError,
		'def erer\n\tcase\n', SyntaxError,
		'def erer\n\tcase >\n', SyntaxError,
		'def erer\n\tcase oo\n\t\tchild\n', Error,
		'def erer\n\tseq\n', SyntaxError,
		'def erer\n\tseq >\n', SyntaxError,
		'lex ID a\ndef erer\n\tseq ID\n\t\tchild oo\n', Error,
		'root-rule ogo\n\tnot\n', SyntaxError
	]);
});

suite('schemes validation', function () {

	var tests = [
		[ '', // empty scheme
			[ '' ], // correct ui
			[ 'e' ] // bad ui text
		],

		[ 'root-rule node', // scheme
			[ '', 'node' ], // success samples
			[ 'o' ]         // fail samples
		],

		[ 'lex ID ([a-z][a-z0-9]*)\nroot-rule node ID', // scheme
			[ '', 'node erer' ],
			[ 'o', 'node', 'node @#@' ]
		],

		[ 'lex ID ([a-z][a-z0-9]*)\nroot-rule node ID\nrule node ID', // scheme
			[ '', 'node erer' ],
			[ 'o', 'node', 'node @#@' ]
		],

		[ '\
lex IP|MASK  ([a-z][a-z0-9]*)\n\
lex BR-OPEN  \\s*\\(\\s*\n\
lex BR-CLOSE \\s*\\)\\s*\n\
lex COMMA    \\s*,\\s*\n\
root-rule node BR-OPEN IP COMMA MASK BR-CLOSE\n\
	rule node',                         // scheme
			[ '', 'node(ip,mask)' ],    // success samples
			[ 'o', 'node', 'node @#@' ] // fail samples
		],

		[ '\
lex ID ([A-Za-z][A-Za-z0-9_-]*)\n\
lex SP \\s+\n\
lex ANY (.+)\n\
root-rule menu\n\
rule menu\n\
	rule group|page\n\
rule group ID\n\
	rule page\n\
rule page ID\n\
	rule module ID\n\
',                              // scheme
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
	group a\n\
		page bbbbbb\n\
	page ERE\n\
		module wr23r4\n\
' ],                             // success samples
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
' ] ],                                          // fail samples

			[ '\
lex ID [A-Za-z][A-Za-z0-9_-]+\n\
lex SP \\s+\n\
lex VALUE \\S+\n\
lex ANY .+\n\
root-rule form (ID (SP ANY)?)?\n\
rule form\n\
	rule text|ip|table ID (SP ANY)?\n\
rule table ID\n\
	rule text|ip ID SP VALUE (SP ANY)?\n\
',                                        // scheme
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
' ],                                      // success samples
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
' ] ],                                        // fail samples


	[ '\
lex ID ([a-z0-9_/-]+)\n\
lex SP \\s+\n\
lex COMMA ,\n\
lex SLASH \\/\n\
lex BR-OPEN \\(\n\
lex BR-CLOSE \\)\n\
lex OPTS (\\{.*\\})\n\
lex VALUE ("(?:[^\\"]|\\\\[\\"])*"|\'(?:[^\\\']|\\\\[\\\'])*\'|[a-z0-9_-]+)\n\
lex BOUNDS (-?\d{0,5}|)\.\.(-?\d{0,5}|)\n\
\n\
lex id|ip|mask|net-ip|net-mask|nets|begin|end|value|list|first|last|key1|key2|key3|key4|default-key ([a-z][a-z0-9_-]*)\n\
\n\
def validator\n\
	case optional\n\
	case is-host|is_net       SP? BR-OPEN SP? ip SP? COMMA SP? mask SP? BR-CLOSE\n\
	case ip-in-net|is-gateway SP? BR-OPEN SP? ip SP? COMMA SP? net-ip SP? COMMA SP? net-mask SP? BR-CLOSE\n\
	case in-nets|not-in-nets  SP? BR-OPEN SP? ip SP? COMMA SP? nets SP? BR-CLOSE\n\
	case ip-pool              SP? BR-OPEN SP? begin SP? COMMA SP? end SP? COMMA SP? net-ip SP? COMMA SP? net-mask SP? BR-CLOSE\n\
	case not-in-list          SP? BR-OPEN SP? value SP? COMMA SP? list SP? BR-CLOSE\n\
	case le|lt|ge|gt          SP? BR-OPEN SP? id SP? BR-CLOSE\n\
\n\
def validators\n\
	seq validator (SP? SLASH SP? validator)*\n\
\n\
rule field ID (SP validators)? (SP OPTS)?\n\
\n\
root-rule field\n\
', [
	'field ogog',
	'field ogog {}',
	'field ogog optional {}',
	'field ogog lt(end-port) {}',
	'field ogog lt(end-port)/optional {}',
	'field ogog lt(end-port)/optional { visible: "oo === \'te\'" }'
],
[
	'field >ogog',
	'field ogog -{}',
	'field ogog opional {}',
	'field ogog lt(end+port) {}',
	'field ogog lt(end-port),optional {}',
	'field ogog lt(end-port)+optional { visible: "oo === \'te\'" }'
]
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
							scheme.process(ui);
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
							scheme.process(ui, 1);
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

