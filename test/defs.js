"use strict";

var assert = require('core-assert'),
    json = require('nano-json'),
    timer = require('nano-timer');


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

var DefsLib = require('../lib/defs.js');

suite('parse sequences', function () {

	var defs = new DefsLib();
	defs.lex('ID', '([A-Z_][A-Z0-9_-]*)');
	defs.lex('TAGS', '([a-zA-Z0-9_-]+(?:\s*\|\s*[a-zA-Z0-9_-]+)*)');
	defs.lex('SP', '\\s+');
	defs.lex('ANY', '(.+)');
	defs.lex('LEXIDS', '([A-Z0-9_-]+(?:\\s*\\|\\s*[A-Z0-9_-]+)*)');

	function parser(t) {
		return defs.seq(t).ast;
	}

	function compact(t) {
		return defs.seq(t).toString();
	}

	massive('good expressions', parser, [
		'', [],
		'TAGS', [ 'lex', 'TAGS', defs.lexemes.TAGS ],
		' TAGS ', [ 'lex', 'TAGS', defs.lexemes.TAGS ],
		' TAGS SP ANY', [ 'seq', [ 'lex', 'TAGS', defs.lexemes.TAGS ], [ 'lex', 'SP', defs.lexemes.SP ], [ 'lex', 'ANY', defs.lexemes.ANY ] ],
		'TAGS ANY?', [ 'seq', [ 'lex', 'TAGS', defs.lexemes.TAGS ], [ '?', [ 'lex', 'ANY', defs.lexemes.ANY ] ] ],
		'(TAGS SP?)', [ 'seq', [ 'lex', 'TAGS', defs.lexemes.TAGS ], [ '?', [ 'lex', 'SP', defs.lexemes.SP ] ] ],
		'ID (SP ANY)?', [ 'seq', [ 'lex', 'ID', defs.lexemes.ID ], [ '?', [ 'seq', [ 'lex', 'SP', defs.lexemes.SP ], [ 'lex', 'ANY', defs.lexemes.ANY ] ] ] ]
	]);

	massive_fails('bad expressions', parser, [
		'aa', SyntaxError,
		'asa>$>', SyntaxError,
		'>a.>', SyntaxError,
		'>a.,>', SyntaxError,
		'>a,b$>', SyntaxError,
		'>a,b,,>', SyntaxError,
		'>a,b b,,>', SyntaxError,
		'>a,(b>', SyntaxError,
		'>a,(,>', SyntaxError,
		'>a|>,', SyntaxError,
		'ID (SP OLO?', SyntaxError,
		'ID (SP ANY?', SyntaxError,
		'ID (?', SyntaxError,
		Object.create(null), TypeError
	]);

	massive('toString', compact, [
		'TAGS', 'TAGS',
		' TAGS ', 'TAGS',
		' TAGS SP ANY', 'TAGS SP ANY',
		'TAGS ANY?', 'TAGS ANY?',
		'(TAGS ANY?)', 'TAGS ANY?',
		'ID (SP ANY)?', 'ID (SP ANY)?',
		'  ID  (  SP  ANY  )  ? ', 'ID (SP ANY)?'
	]);

});

function newDefsLib() {
	var defs = new DefsLib();
	defs.lex('SP', '\\s+');
	defs.lex('COMMA', ',');
	defs.lex('SLASH', '\\/');
	defs.lex('BR-OPEN', '\\(');
	defs.lex('BR-CLOSE', '\\)');
	defs.lex('ANY', '(.+)');
	defs.lex('ID|ip|mask|net-ip|net-mask|nets|begin|end|value|list|id', '([A-Za-z_][A-Za-z0-9_-]*)');
	defs.lex('TAGS', '([a-zA-Z0-9_-]+(?:\s*\|\s*[a-zA-Z0-9_-]+)*)');
	defs.lex('OPT', '([a-z][a-z0-9_]*)');
	defs.lex('VALUE', '(\\d+)');
	defs.lex('BOUNDS', '(-?\\d{1,5}|)\\.\\.(-?\\d{1,5}|)');
	defs.lex('LEXIDS', '([A-Z0-9_-]+(?:\\s*\\|\\s*[A-Z0-9_-]+)*)');

	return defs;
}

function newTester(src) {
	var lex = newDefsLib().seq(src).toFunction();

	return function (text) {
		var c = lex(text);
		if (c.error)
			throw c.error;
		return c;
	};
}

suite('compile to parser', function () {

	var src = 'ID SP ANY',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID  { values:1 }', { length:21, ID: 'SOME-ID', ANY:'{ values:1 }' },
		'A {}', { length: 4, ID:'A', ANY:'{}' }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'', SyntaxError,
		'aa', SyntaxError,
		'>$>', SyntaxError,
		'>a.>', SyntaxError,
		'>a.,>', SyntaxError,
		Object.create(null), TypeError,
		'A[]', SyntaxError,
		'[]', SyntaxError
	]);

});

suite('compile to parser 2', function () {
	var src = 'ID (SP ANY)?',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID  { values:1 }', { length:21, ID: 'SOME-ID', ANY:'{ values:1 }' },
		'A {}', { length: 4, ID:'A', ANY:'{}' },
		'A', { length: 1, ID:'A' }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'', SyntaxError,
		'>$>', SyntaxError,
		'>a.>', SyntaxError,
		'>a.,>', SyntaxError,
		Object.create(null), TypeError,
		'A[]', SyntaxError,
		'[]', SyntaxError
	]);

});

suite('compile to parser 3', function () {
	var src = 'ID SP VALUE SP ANY',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 55 {}', { length:13, ID: 'SOME-ID', VALUE:'55', ANY:'{}' }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'', SyntaxError,
		'aa', SyntaxError,
		'>$>', SyntaxError,
		'>a.>', SyntaxError,
		'>a.,>', SyntaxError,
		'ID (SP OLO?', SyntaxError,
		'ID (?', SyntaxError,
		Object.create(null), TypeError,
		'A[]', SyntaxError,
		'[]', SyntaxError
	]);
});

suite('compile to parser 4', function () {
	var src = 'ID SP BOUNDS SP ANY',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 1..77 {}', { length:16, ID: 'SOME-ID', BOUNDS:['1','77'], ANY:'{}' },
		'SOME-ID -16..15 {}', { length:18, ID: 'SOME-ID', BOUNDS:['-16','15'], ANY:'{}' }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'', SyntaxError,
		'aa', SyntaxError,
		'>$>', SyntaxError,
		'>a.>', SyntaxError,
		'sdf 11', SyntaxError,
		'sdf 11..', SyntaxError,
		'sdf ..11', SyntaxError,
		'ID (SP OLO?', SyntaxError,
		'ID (?', SyntaxError,
		Object.create(null), TypeError,
		'A[]', SyntaxError,
		'[]', SyntaxError
	]);
});

suite('compile to parser 5', function () {
	var src = 'ID? (SP BOUNDS)? (SP ANY)?',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 1..77 {}', { length:16, ID: 'SOME-ID', BOUNDS:['1','77'], ANY:'{}' },
		'SOME-ID -16..15 {}', { length:18, ID: 'SOME-ID', BOUNDS:['-16','15'], ANY:'{}' },
		'SOME-ID ..15 {}', { length:15, ID: 'SOME-ID', BOUNDS:['','15'], ANY:'{}' },
		'SOME-ID 15.. {}', { length:15, ID: 'SOME-ID', BOUNDS:['15',''], ANY:'{}' },
		'kklk 0..1 { visible: "method !== \'disabled\'" }', { length:46, ID: 'kklk', BOUNDS:['0','1'], ANY:'{ visible: "method !== \'disabled\'" }' },
		'', { length:0 },
		'aa', { length:2, ID: 'aa' }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'>$>', SyntaxError,
		'>a.>', SyntaxError,
		Object.create(null), TypeError,
		'A[]', SyntaxError,
		'[]', SyntaxError
	]);
});

suite('compile to parser 6 repeats', function () {
	var src = 'ID SP ID',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID OOO', { length:11, ID: [ 'SOME-ID', 'OOO' ] }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID', SyntaxError,
		'SOME-ID ', SyntaxError
	]);
});

suite('compile to parser 7 repeats', function () {
	var src = 'ID (SP ID)+',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID OOO', { length:11, ID: [ 'SOME-ID', 'OOO' ] },
		'SOME-ID OOO LLL', { length:15, ID: [ 'SOME-ID', 'OOO', 'LLL' ] }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID', SyntaxError,
		'SOME-ID ', SyntaxError
	]);
});

suite('compile to parser 8 repeats', function () {
	var src = 'ID (SP ID)*',
	    tester = newTester(src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID', { length:7, ID: [ 'SOME-ID' ] },
		'SOME-ID OOO', { length:11, ID: [ 'SOME-ID', 'OOO' ] },
		'SOME-ID OOO LLL', { length:15, ID: [ 'SOME-ID', 'OOO', 'LLL' ] }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError
	]);
});

function newDefSeqTester(name, dseq, seq) {
	var defs = newDefsLib(),
	    def = defs.def(name);
	def.seq(dseq);
	var lex = defs.seq(seq).toFunction();
	return function (text) {
		var c = lex(text);
		if (c.error)
			throw c.error;
		return c;
	};
}

suite('seq uses defs', function () {
	var src = 'ID (SP opts)? SP VALUE',
	    tester = newDefSeqTester('opts', 'OPT (COMMA OPT)*', src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 123', { length:11, ID: 'SOME-ID', VALUE: '123' },
		'SOME-ID demo 333', { length:16, ID: 'SOME-ID', VALUE: '333', opts:{ OPT:['demo'] } },
		'SOME-ID demo,test 333', { length:21, ID: 'SOME-ID', VALUE: '333', opts:{ OPT:['demo', 'test'] } }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError,
		'SOME-ID demo test 333', SyntaxError
	]);
});

function newDefSeqTester2(name, dseq, dseq2, seq) {
	var defs = newDefsLib(),
	    def = defs.def(name);
	def.seq(dseq);
	def.seq(dseq2);
	var lex = defs.seq(seq).toFunction();
	return function (text) {
		var c = lex(text);
		if (c.error)
			throw c.error;
		return c;
	};
}

suite('seq uses defs 2', function () {
	var src = 'ID (SP opts)? SP VALUE',
	    tester = newDefSeqTester2('opts', 'OPT (COMMA opts)', 'OPT', src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 123', { length:11, ID: 'SOME-ID', VALUE: '123' },
		'SOME-ID demo 333', { length:16, ID: 'SOME-ID', VALUE: '333', opts:{ OPT:'demo' } },
		'SOME-ID demo,test 333', { length:21, ID: 'SOME-ID', VALUE: '333', opts:{ OPT:'demo', opts:{ OPT:'test' } } }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError
	]);
});

suite('seq uses defs 3', function () {
	var src = 'ID (SP opts)? SP VALUE (SP opts)?',
	    tester = newDefSeqTester2('opts', 'OPT (COMMA opts)', 'OPT', src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 123', { length:11, ID: 'SOME-ID', VALUE: '123' },
		'SOME-ID demo 333', { length:16, ID: 'SOME-ID', VALUE: '333', opts:[ { OPT:'demo' } ] },
		'SOME-ID demo,test 333', { length:21, ID: 'SOME-ID', VALUE: '333', opts:[ { OPT:'demo', opts:{ OPT:'test' } } ] },
		'SOME-ID demo,test 333 ogo,olo', { length:29, ID: 'SOME-ID', VALUE: '333', opts:[ { OPT:'demo', opts:{ OPT:'test' } }, { OPT:'ogo', opts:{ OPT:'olo' } } ] }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError
	]);
});




function newDefCasesTester(name, cases, seq) {
	var defs = newDefsLib(),
	    def = defs.def(name);
	for (var id in cases)
		def['case'](id, cases[id]);
	var lex = defs.seq(seq).toFunction();
	return function (text) {
		var c = lex(text);
		if (c.error)
			throw c.error;
		return c;
	};
}

suite('seq uses defs with cases', function () {
	var src = 'ID (SP opt (COMMA opt)*)? SP VALUE',
	    tester = newDefCasesTester('opt', {
	    	'optional': '', 'ascii': ''}, src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 123', { length:11, ID: 'SOME-ID', VALUE: '123' },
		'SOME-ID optional 333', { length:20, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'optional' } ] },
		'SOME-ID ascii 333', { length:17, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'ascii' } ] },
		'SOME-ID ascii,optional 333', { length:26, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'ascii' }, { case:'optional' } ] },
		'SOME-ID optional,ascii 333', { length:26, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'optional' }, { case:'ascii' } ] }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError
	]);
});



function newDefCasesAndSeqsTester(name, cases, seqs, seq) {
	var defs = newDefsLib(),
	    def = defs.def(name);
	for (var id in cases)
		def['case'](id, cases[id]);
	for (var i = 0, n = seqs.length; i < n; ++i)
		def.seq(seqs[i]);
	var lex = defs.seq(seq).toFunction();
	return function (text) {
		var c = lex(text);
		if (c.error)
			throw c.error;
		return c;
	};
}

suite('seq uses defs with cases and seqs', function () {
	var src = 'ID (SP opt (COMMA opt)*)? SP VALUE',
	    tester = newDefCasesAndSeqsTester('opt', {
	    	'optional': '', 'ascii': ''},
	    	[ 'ID' ],
	    	src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 123', { length:11, ID: 'SOME-ID', VALUE: '123' },
		'SOME-ID optional 333', { length:20, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'optional' } ] },
		'SOME-ID ascii 333', { length:17, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'ascii' } ] },
		'SOME-ID ascii,optional 333', { length:26, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'ascii' }, { case:'optional' } ] },
		'SOME-ID optional,ascii 333', { length:26, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'optional' }, { case:'ascii' } ] },
		'SOME-ID optional,aii 333', { length:24, ID: 'SOME-ID', VALUE: '333', opt:[ { case:'optional' }, { ID:'aii' } ] }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError
	]);
});


suite('seq uses defs with cases and seqs (empty def)', function () {
	var src = 'ID opt SP VALUE',
	    tester = newDefCasesAndSeqsTester('opt', {}, [], src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID 123', { length:11, ID: 'SOME-ID', VALUE: '123', opt:{} }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError
	]);
});


function newDefsTester(ds, seq) {
	var defs = newDefsLib();

	ds.forEach(function (d) {
		var name = d[0],
		    cases = d[1],
		    seqs = d[2],
		    def = defs.def(name);
		for (var id in cases)
			def['case'](id, cases[id]);
		for (var i = 0, n = seqs.length; i < n; ++i)
			def.seq(seqs[i]);
	});

	var lex = defs.seq(seq).toFunction();
	return function (text) {
		var c = lex(text);
		if (c.error)
			throw c.error;
		return c;
	};
}

suite('seq uses defs with cases and seqs (WUI-validators)', function () {
	var src = 'TAGS (SP validators)? (SP ANY)?',
	    tester = newDefsTester([
	    	[ 'validator', {
	    			'optional': '',
	    			'is-host|is-net':       'SP? BR-OPEN SP? ip SP? COMMA SP? mask SP? BR-CLOSE',
	    			'ip-in-net|is-gateway': 'SP? BR-OPEN SP? ip SP? COMMA SP? net-ip SP? COMMA SP? net-mask SP? BR-CLOSE',
	    			'in-nets|not-in-nets':  'SP? BR-OPEN SP? ip SP? COMMA SP? nets SP? BR-CLOSE',
	    			'ip-pool':              'SP? BR-OPEN SP? begin SP? COMMA SP? end SP? COMMA SP? net-ip COMMA SP? net-mask SP? BR-CLOSE',
	    			'not-in-list':          'SP? BR-OPEN SP? value SP? COMMA SP? list SP? BR-CLOSE',
	    			'le|lt|ge|gt':          'SP? BR-OPEN SP? id SP? BR-CLOSE'
	    		}, [] ],
	    	[ 'validators', {}, [ 'validator (COMMA validator)*' ] ]
	    ], src);

	massive('good expressions ['+src+']', tester, [
		'SOME-ID', { length:7, TAGS: 'SOME-ID' },
		'SOME-ID { }', { length:11, TAGS: 'SOME-ID', ANY: '{ }' },
		'SOME-ID qq { }', { length:14, TAGS: 'SOME-ID', ANY: 'qq { }' },
		'SOME-ID optional { }', { length:20, TAGS: 'SOME-ID', ANY: '{ }', validators: { validator: [ { case:'optional' }]} },
		'SOME-ID is-net(ip,ip-mask) { }', { length:30, TAGS: 'SOME-ID', ANY: '{ }', validators: { validator: [ { case:'is-net', ip:'ip', 'mask':'ip-mask' }]} },
		'SOME-ID is-net(ip,ip-mask),optional { }', { length:39, TAGS: 'SOME-ID', ANY: '{ }', validators: { validator: [ { case:'is-net', ip:'ip', 'mask':'ip-mask' }, { case:'optional' }]} }
	]);

	massive_fails('bad expressions ['+src+']', tester, [
		'SOME-ID ', SyntaxError
	]);
});

