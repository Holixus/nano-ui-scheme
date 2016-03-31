/*

-- tokens
SPACE     \s*
ID        [A-Z_][A-Z0-9_-]*
BR-OPEN   \(
BR-CLOSE  \)
OPTIONAL  \?

-- syntax
lex-id    ID

group     '(' expr ')'
          lex-id

opt       group '?'
          group

seq       opt seq
          opt

expr      seq

*/

var ID = 1, BOPEN = '(', BCLOSE = ')', OPT = '?',
    LEX = 'lex', SEQ = 'seq';

function tokenize(seq) {
	var re = /([A-Z0-9_-]+)|([()?])|(\S)|\s+/g;

	var tokens = [], len = seq.length;
	if (!seq)
		return tokens;
	do {
		var li = re.lastIndex;
		if (li >= len)
			return tokens; // finish
		var l = re.exec(seq);
		/* istanbul ignore if */
		if (!l)
			break;
		if (l[1])
			tokens.push(ID, l[1]);
		else
			if (l[2])
				tokens.push(l[2]);
	} while (!l[3]);
	throw SyntaxError('['+li+'] "'+seq+'"');
}

function ArgsParser(text, regexps) {

	var tokens = tokenize(text);

	var pos = 0;

	function lex() {
		if (tokens[pos] !== ID)
			return;
		var id = tokens[pos+1];
		pos += 2;
		var re = regexps[id];
		if (!re)
			throw SyntaxError('not defined RegExp for lexeme: "'+id+'"');
		return [ LEX, id, re ];
	}

	function group() {
		if (tokens[pos] === BOPEN) {
			var bp = pos;
			++pos;
			var ex = expr();
			if (ex)
				if (tokens[pos] === BCLOSE)
					return ++pos, ex;
			throw SyntaxError('not closed bracket at position '+pos);
			//pos = bp;
			//return ;
		}
		return lex();
	}

	function opt() {
		var p = group();
		if (!p)
			return;
		if (tokens[pos] !== OPT)
			return p;
		++pos;
		return [ OPT, p ];
	}

	function seq() {
		var p = opt();
		if (!p)
			return;
		var ex = seq();
		if (ex) {
			if (ex[0] !== SEQ)
				return [ SEQ, p, ex ];
			ex.splice(1, 0, p)
			return ex;
		}
		return p;
	}

	function expr() {
		return seq();
	}

	//console.log(tokens);
	var ret = this.ast = expr();
	this.str = undefined;
	//console.log(ret);
	if (!ret || pos < tokens.length)
		throw SyntaxError('unexpected token: "'+tokens[pos]+'"');
}

ArgsParser.tokenize = tokenize;

ArgsParser.prototype = {
	toString: function uncompile() {
		function un(ast, sub) {
			switch (ast[0]) {
			case 'seq':
				var s = [];
				for (var i = 1, n = ast.length; i < n; ++i)
					s.push(un(ast[i], 1));
				s = s.join(' ');
				return sub ? '('+s+')' : s;
			case '?':
				return un(ast[1], 1)+'?';
			case 'lex':
				return ast[1];
			}
		}
		return this.str || (this.str = un(this.ast));
	},
	toFunction: function compile_lexpr() {
		function sub_compile(ast) {
			switch (ast[0]) {
			case 'seq':
				return (function (seq) {
					return function (text, start, ctx) {
						var pos = start;
						for (var i = 0, n = seq.length; i < n; ++i) {
							var next = seq[i](text, pos, ctx);
							if (next < 0)
								return next;
							pos = next;
						}
						//console.log('SEQ: "%s"', text.slice(start, pos >= 0 ? pos : pos));
						return pos;
					};
				})(ast.slice(1).map(sub_compile));
			case '?':
				return (function (lex) {
					return function (text, pos, ctx) {
						var p = lex(text, pos, ctx);
						//console.log('OPT: "%s"', text.slice(pos, p >= 0 ? p : pos));
						return p >= pos ? p : pos;
					};
				})(sub_compile(ast[1]));
			case 'lex':
				return (function (name, re) {
					return function (text, pos, ctx) {
						re.lastIndex = pos;
						var s = re.exec(text);
						//console.log('LEX: "%s"', s[0]);
						return s && s[0] ? (ctx[name] = s[0], re.lastIndex) : -pos-1;
					};
				})(ast[1], ast[2]);
			}
		}
 
		return (function (compiled) {
			return function (text) {
				var ctx = {},
				    pos = compiled(text, 0, ctx);
				if (pos < 0)
					return ctx.error = SyntaxError('Syntax error at position: '+(ctx.length = -pos-1)), ctx;
				if (pos < text.length)
					return ctx.error = SyntaxError('Syntax error at position: '+(ctx.length = pos)), ctx;
				return ctx.length = pos, ctx;
			};
		})(sub_compile(this.ast));
	}
};

module.exports = ArgsParser;
