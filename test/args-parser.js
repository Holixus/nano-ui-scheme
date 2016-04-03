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

var ArgsParser = require('../lib/args-parser.js');

suite('parse sequences', function () {

	var lexemes = {
		ID: /[A-Z_][A-Z0-9_-]*|/g,
		TAGS: /[a-zA-Z0-9_-]+(?:\s*\|\s*[a-zA-Z0-9_-]+)*|/g,
		SP: /\s+|/g,
		ANY: /.+/g,
		LEXIDS: /[A-Z0-9_-]+(?:\s*\|\s*[A-Z0-9_-]+)*|/g
	};

	function parser(t) {
		return new ArgsParser(t, lexemes).ast;
	}

	function compact(t) {
		return new ArgsParser(t, lexemes).toString();
	}

	massive('good expressions', parser, [
		'TAGS', [ 'lex', 'TAGS', lexemes.TAGS ],
		' TAGS ', [ 'lex', 'TAGS', lexemes.TAGS ],
		' TAGS SP ANY', [ 'seq', [ 'lex', 'TAGS', lexemes.TAGS ], [ 'lex', 'SP', lexemes.SP ], [ 'lex', 'ANY', lexemes.ANY ] ],
		'TAGS ANY?', [ 'seq', [ 'lex', 'TAGS', lexemes.TAGS ], [ '?', [ 'lex', 'ANY', lexemes.ANY ] ] ],
		'(TAGS SP?)', [ 'seq', [ 'lex', 'TAGS', lexemes.TAGS ], [ '?', [ 'lex', 'SP', lexemes.SP ] ] ],
		'ID (SP ANY)?', [ 'seq', [ 'lex', 'ID', lexemes.ID ], [ '?', [ 'seq', [ 'lex', 'SP', lexemes.SP ], [ 'lex', 'ANY', lexemes.ANY ] ] ] ]
	]);

	massive_fails('bad expressions', parser, [
		'', SyntaxError,
		'aa', SyntaxError,
		'>$>', SyntaxError,
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

suite('compile to parser', function () {
	var res = {
			ID: /[a-zA-Z0-9_-]+|/g,
			SP: /\s+|/g,
			ANY:/.+|/g,
			BOUNDS: /(-?\d{1,5})\.\.(-?\d{1,5})|/g
		},
	    text = 'ID SP ANY',
	    lex = new ArgsParser(text, res).toFunction(),
	    tester = function (text) {
	    	var c = lex(text);
	    	if (c.error)
	    		throw c.error;
	    	return c;
	    };

	//console.log(text);
	//console.log(lex);
	//console.log(tester.toString());

	massive('good expressions ['+text+']', tester, [
		'SOME-ID  { values:1 }', { length:21, ID: 'SOME-ID', SP:'  ', ANY:'{ values:1 }' },
		'A {}', { length: 4, ID:'A', SP:' ', ANY:'{}' }
	]);

	massive_fails('bad expressions ['+text+']', tester, [
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
	var res = {
			ID: /[a-zA-Z0-9_-]+|/g,
			SP: /\s+|/g,
			ANY:/.+|/g,
			BOUNDS: /(-?\d{1,5})\.\.(-?\d{1,5})|/g
		},
	    text = 'ID (SP ANY)?',
	    lex = new ArgsParser(text, res).toFunction(),
	    tester = function (text) {
	    	var c = lex(text);
	    	if (c.error)
	    		throw c.error;
	    	return c;
	    };

	//console.log(text);
	//console.log(lex);
	//console.log(tester.toString());

	massive('good expressions ['+text+']', tester, [
		'SOME-ID  { values:1 }', { length:21, ID: 'SOME-ID', SP:'  ', ANY:'{ values:1 }' },
		'A {}', { length: 4, ID:'A', SP:' ', ANY:'{}' },
		'A', { length: 1, ID:'A' }
	]);

	massive_fails('bad expressions ['+text+']', tester, [
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
	var res = {
			ID: /[a-zA-Z0-9_-]+|/g,
			SP: /\s+|/g,
			VALUE: /\d+|/g,
			ANY:/.+|/g,
			BOUNDS: /(-?\d{1,5})\.\.(-?\d{1,5})|/g
		},
	    text = 'ID SP VALUE SP ANY',
	    lex = new ArgsParser(text, res).toFunction(),
	    tester = function (text) {
	    	var c = lex(text);
	    	if (c.error)
	    		throw c.error;
	    	return c;
	    };

	//console.log(text);
	//console.log(lex);
	//console.log(tester.toString());

	massive('good expressions ['+text+']', tester, [
		'SOME-ID 55 {}', { length:13, ID: 'SOME-ID', SP:' ', VALUE:'55', ANY:'{}' }
	]);

	massive_fails('bad expressions ['+text+']', tester, [
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
	var res = {
			ID: /[a-zA-Z0-9_-]+|/g,
			SP: /\s+|/g,
			VALUE: /\d+|/g,
			ANY:/.+|/g,
			BOUNDS: /(-?\d{1,5})\.\.(-?\d{1,5})|/g
		},
	    text = 'ID SP BOUNDS SP ANY',
	    lex = new ArgsParser(text, res).toFunction(),
	    tester = function (text) {
	    	var c = lex(text);
	    	if (c.error)
	    		throw c.error;
	    	return c;
	    };

	//console.log(text);
	//console.log(lex);
	//console.log(tester.toString());

	massive('good expressions ['+text+']', tester, [
		'SOME-ID 1..77 {}', { length:16, ID: 'SOME-ID', SP:' ', BOUNDS:['1','77'], ANY:'{}' },
		'SOME-ID -16..15 {}', { length:18, ID: 'SOME-ID', SP:' ', BOUNDS:['-16','15'], ANY:'{}' }
	]);

	massive_fails('bad expressions ['+text+']', tester, [
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
	var res = {
			ID: /[a-zA-Z0-9_-]+|/g,
			SP: /\s+|/g,
			VALUE: /\d+|/g,
			ANY:/.+|/g,
			BOUNDS: /(-?\d{0,5})\.\.(-?\d{0,5})|/g
		},
	    text = 'ID? (SP BOUNDS)? (SP ANY)?',
	    lex = new ArgsParser(text, res).toFunction(),
	    tester = function (text) {
	    	var c = lex(text);
	    	if (c.error)
	    		throw c.error;
	    	return c;
	    };

	//console.log(text);
	//console.log(lex);
	//console.log(tester.toString());

	massive('good expressions ['+text+']', tester, [
		'SOME-ID 1..77 {}', { length:16, ID: 'SOME-ID', SP:' ', BOUNDS:['1','77'], ANY:'{}' },
		'SOME-ID -16..15 {}', { length:18, ID: 'SOME-ID', SP:' ', BOUNDS:['-16','15'], ANY:'{}' },
		'SOME-ID ..15 {}', { length:15, ID: 'SOME-ID', SP:' ', BOUNDS:['','15'], ANY:'{}' },
		'SOME-ID 15.. {}', { length:15, ID: 'SOME-ID', SP:' ', BOUNDS:['15',''], ANY:'{}' },
		'', { length:0 },
		'aa', { length:2, ID: 'aa' }
	]);

	massive_fails('bad expressions ['+text+']', tester, [
		'>$>', SyntaxError,
		'>a.>', SyntaxError,
		Object.create(null), TypeError,
		'A[]', SyntaxError,
		'[]', SyntaxError
	]);
});

