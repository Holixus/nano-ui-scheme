
function newObject() {
	return {}; // Object.create(null);
}

/*

-- tokens
SPACE     \s*
ID        [A-Z_][A-Z0-9_-]*
BR-OPEN   \(
BR-CLOSE  \)
OR        \|
OPTIONAL  \?
PLUS      \+
STAR      \*

-- syntax
lex-id    ID
def-id    ID

group     '(' expr ')'
          def-id
          lex-id

postfix   group '?'
          group '+'
          group '*'
          group

seq       postfix+

set       seq ('|' seq)*

expr      set

*/

var ID = 1, BOPEN = '(', BCLOSE = ')', OPT = '?', PLUS = '+', STAR = '*', OR = '|',
    LEX = 'lex', DEF = 'def', SEQ = 'seq', SET = 'set';

function tokenize(seq) {
	var re = /([A-Za-z0-9_-]+)|([()?$+*|])|(\S)|\s+/g;

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

var CASE_ID = /([a-zA-Z0-9_-]+)|/g;

function DefsLib() {
	this.lexemes = newObject();
	this.defs = newObject();
}

DefsLib.prototype = {
	lex: function (name, text) {
		var ls = this.lexemes,
		    re = new RegExp(text+'|', 'g');
		name.split(/\s*\|\s*/).forEach(function (id) {
			if (id in ls)
				throw Error('lex '+id+' duplication');
			ls[id] = re;
		});
	},
	def: function (name) {
		if (name in this.defs)
			throw Error('def '+name+' duplication');
		return this.defs[name] = new Def(name, this);
	},
	seq: function (src) {
		return new SeqParser('', src, this);
	}
};

function Def(name, lib) {
	this.name = name;
	this.lib = lib;
	this.seqs = undefined;
	this.cases = undefined;
	this.fn = undefined;
}

Def.prototype = {
	seq: function (src) {
		if (!this.seqs)
			this.seqs = [];
		this.seqs.push(new SeqParser(this.name, src, this.lib));
	},

	'case': function (ids, src) {
		var cases = this.cases || (this.cases = newObject()),
		    seq = new SeqParser(this.name, src, this.lib)
		ids.split(/\s*\|\s*/).forEach(function (id) {
			cases[id] = seq;
		});
	},

	compile: function () {
		if (this.fn)
			return typeof this.fn !== 'function' ? (function (s) {
				return function () { return s.fn.apply(s, arguments); };
			})(this) : this.fn;

		this.fn = true;

		var seqs = this.seqs ? (function (name, seq_fns) {
			return function (text, pos, ctx) {
				for (var i = 0, n = seq_fns.length; i < n; ++i) {
					var next = seq_fns[i](text, pos, ctx);
					if (next >= 0)
						return next;
				}
				return -pos-1;
			};
		})(this.name, this.seqs.map(function (seq) { return seq.compile(); })) : 0;

		var cases = this.cases;
		if (cases) {
			var cs = newObject();
			Object.keys(this.cases).forEach(function (id) {
				cs[id] = cases[id].compile();
			});
			cases = (function (name, cs, case_id) {
				return function (text, pos, ctx) {
					case_id.lastIndex = pos;
					var next = case_id.exec(text);
					if (!next || !next[1])
						return -pos-1;
					var id = next[1],
					    c = cs[id];
					if (!c)
						return -pos-1;
					ctx.case = id;
					next = c(text, case_id.lastIndex, ctx);
					//if (next < 0)
						//delete ctx.tag;
					return next;
				};
			})(this.name, cs, CASE_ID);
		}
		if (seqs && cases)
			return this.fn = function (text, pos, ctx) {
				var next = cases(text, pos, ctx);
				if (next >= 0)
					return next;
				return seqs(text, pos, ctx);
			};

		return this.fn = (seqs || cases || function (text, pos, ctx) { return pos; });
	}
};

function SeqParser(name, text, lib) {

	var tokens = tokenize(text),
	    pos = 0,
	    lists = newObject();

	var lexes = lib.lexemes,
	    defs = lib.defs;

	function lex() {
		if (tokens[pos] !== ID)
			return;
		var id = tokens[pos+1];
		pos += 2;
		var re = lexes[id];
		if (!re) {
			var def = defs[id];
			if (!def)
				throw SyntaxError('unknown lex-id or def-id for lexeme: "'+id+'"');
			return [ DEF, id, def ];
		}
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

	function postfix() {
		var p = group();
		if (!p)
			return;
		switch (tokens[pos]) {
		case OPT:
			++pos;
			return [ OPT, p ];
		case STAR:
			++pos;
			return [ STAR, p ];
		case PLUS:
			++pos;
			return [ PLUS, p ];
		}
		return p;
	}

	function seq() {
		var p = postfix();
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

	function set() {
		var sq = seq();
		if (!sq) // empty sequence isn't possible
			return;
		if (tokens[pos] === OR) {
			var bp = pos;
			++pos;
			var st = set();
			if (st) {
				if (st[0] !== SET)
					return [ SET, sq, st ];
				st.splice(1, 0, sq);
				return st;
			}
			throw SyntaxError('choice suntax error; invalid token after \'|\' symbol '+pos);
		}
		return sq;
	}

	function expr() {
		return set();
	}

	function mark_lists(ast, rep) {
		switch (ast[0]) {
		case SET:
		case SEQ:
			for (var i = 1, n = ast.length; i < n; ++i)
				mark_lists(ast[i], rep);
			break;
		case OPT:
			return mark_lists(ast[1], 0);
		case PLUS:
		case STAR:
			return mark_lists(ast[1], 1);
		case LEX:
			var id = ast[1];
			if (id in lists)
				++lists[id];
			else
				lists[id] = rep;
			break;
		case DEF:
			var id = ast[1];
			if (id in lists)
				++lists[id];
			else
				lists[id] = rep;
			break;
		}
	}

	//console.log(tokens);
	var ret = this.ast = tokens.length ? expr() : [];
	if (pos < tokens.length)
		throw SyntaxError('invalid token '+pos);
	mark_lists(ret, 0);
	this.lists = lists;
	this.str = undefined;
	this.fn = undefined;
//	if (tokens.length && pos < tokens.length)
//		throw SyntaxError('unexpected token: "'+tokens[pos]+'"');
}

SeqParser.tokenize = tokenize;

SeqParser.prototype = {
	toString: function uncompile() {
		function un(ast, sub) {
			switch (ast[0]) {
			case SET:
			case SEQ:
				var s = [];
				for (var i = 1, n = ast.length; i < n; ++i)
					s.push(un(ast[i], 1));
				s = s.join(ast[0] === SET ? ' | ' : ' ');
				return sub ? '('+s+')' : s;
			case OPT:
			case PLUS:
			case STAR:
				return un(ast[1], 1)+ast[0];
			case LEX:
			case DEF:
				return ast[1];
			}
		}
		return this.str || (this.str = un(this.ast));
	},
	compile: function () {
		var lists = this.lists;
		function sub_compile(ast) {
			switch (ast[0]) {
			case 'set':
				return (function (set) {
					return function (text, start, ctx) {
						var pos = start;
						for (var i = 0, n = set.length; i < n; ++i) {
							var next = set[i](text, pos, ctx);
							//console.log('set-%d "%s" %s', i, text.slice(pos, next >= pos ? next : pos), next);
							if (next >= 0)
								return next;
						}
						//console.log('SET: "%s"', text.slice(start, pos >= 0 ? pos : pos));
						return -pos-1; // nothing fit
					};
				})(ast.slice(1).map(sub_compile));
			case 'seq':
				return (function (seq) {
					return function (text, start, ctx) {
						var pos = start;
						for (var i = 0, n = seq.length; i < n; ++i) {
							var next = seq[i](text, pos, ctx);
							//console.log('seq-%d "%s" %s', i, text.slice(pos, next >= pos ? next : pos), next);
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
						//console.log('OPT<%s/%s>: "%s"', pos, p, text.slice(pos, p >= pos ? p : pos));
						//delete ctx._lex;
						return p >= pos ? p : pos;
					};
				})(sub_compile(ast[1]));
			case '*':
				return (function (lex) {
					return function (text, pos, ctx) {
						var p;
						while ( (p = lex(text, pos, ctx)) >= 0)
							pos = p;
						return pos;
					};
				})(sub_compile(ast[1]));
			case '+':
				return (function (lex) {
					return function (text, pos, ctx) {
						var p = lex(text, pos, ctx);
						if (p < 0)
							return p;
						pos = p;
						while ( (p = lex(text, pos, ctx)) >= 0)
							pos = p;
						return pos;
					};
				})(sub_compile(ast[1]));
			case 'lex':
				return (function (name, re) {
					return function (text, pos, ctx) {
						re.lastIndex = pos;
						var s = re.exec(text);
						//console.log('LEX-%s: "%s"', name, s[0], re.lastIndex);
						if (s && s[0]) {
							var top = 6, ret;
							while (!(top in s)) --top;
							if (top) {
								if (top == 1)
									ret = s[1];
								else {
									ret = [];
									for (; top; --top)
										ret.unshift(s[top]);
								}
							}
							if (ret)
								if (lists[name]) {
									if (!ctx[name])
										ctx[name] = [ ret ];
									else
										ctx[name].push(ret);
								} else
									ctx[name] = ret;
							//console.log('  ))', re.lastIndex);
							return re.lastIndex;
						}
						//console.log('  %d "%s"', -pos-1, text.slice(pos));
						//console.log('     "%s"', re.toString());
						//ctx._lex = name;
						return -pos-1;
					};
				})(ast[1], ast[2]);
			case 'def':
				return (function (name, fn) {
					return lists[name] ? function (text, pos, ctx) {
						var sub_ctx = newObject(),
						    next = fn(text, pos, sub_ctx);
						if (next >= 0) {
							if (ctx[name])
								ctx[name].push(sub_ctx);
							else
								ctx[name] = [ sub_ctx ];
						}
						return next;
					} : function (text, pos, ctx) {
						var sub_ctx = newObject(),
						    next = fn(text, pos, sub_ctx);
						if (next >= 0)
							ctx[name] = sub_ctx;
						return next;
					};
				})(ast[1], ast[2].compile());
			}
		}
		return this.fn || (this.fn = this.ast.length ?
			sub_compile(this.ast) :
			function (text, pos, ctx) { return pos; });
	},
	toFunction: function compile_lexpr() {
		var compiled = this.compile();
		return function (text) {
			var ctx = newObject(),
			    pos = compiled(text, 0, ctx);
			if (pos < 0)
				return ctx.error = SyntaxError('Syntax error at position: '+(ctx.length = -pos-1)/*+(ctx._lex ? ' lex:'+ctx._lex : '')*/), ctx;
			if (pos < text.length)
				return ctx.error = SyntaxError('Syntax error at tail position: '+(ctx.length = pos)/*+(ctx._lex ? ' lex:'+ctx._lex : '')*/), ctx;
			return ctx.length = pos, ctx;
		};
	}
};

module.exports = DefsLib;
