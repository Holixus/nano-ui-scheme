

var ArgsParser = require('./lib/args-parser.js');

var TAGS = /[a-zA-Z0-9_-]+(?:\s*\|\s*[a-zA-Z0-9_-]+)*|/g,
	SP = /\s+|/g,
	ANY = /.+/g,
	LEXIDs = /[A-Z0-9_-]+(?:\s*\|\s*[A-Z0-9_-]+)*|/g;

function Rule(tags, args) {
	this.tags = tags;
	this.args = args;
	this.rules = undefined;
}
Rule.prototype = {
	match: function (tag) {
		return this.tags.indexOf(tag) >= 0;
	},
	enum: function (cb) {
		cb(this);
		if (this.rules)
			this.rules.forEach(function (rule) {
				rule.enum(cb);
			});
	},
	add: function (tags, args) {
		var rule;
		(this.rules || (this.rules = [])).push(rule = new Rule(tags, args));
		return rule;
	}
};


function UiScheme(ui) {
	var common_rules = this.common_rules = new Rule([], ''),
	    root_rules = this.root_rules = new Rule([], ''),
	    s_lexemes = {},
	    args_parsers = {};

	if (!ui.children)
		return;

	function ui_lex(node) {
		// LEXIDs SP ANY
		var text = node.args;
		if (!text)
			throw SyntaxError('lex hasn`t LEXIDs in the row '+node.srow);
		LEXIDs.lastIndex = 0;
		var lexids = LEXIDs.exec(text);
		if (!lexids || !lexids[0])
			throw SyntaxError('lex: bad LEXIDs in the row '+node.srow);
		SP.lastIndex = LEXIDs.lastIndex;
		SP.exec(text);
		ANY.lastIndex = SP.lastIndex;
		var any = ANY.exec(text);
		if (!any || !any[0])
			throw SyntaxError('lex: missed regexp in the row '+node.srow);
		var re = new RegExp(any[0]+'|', 'g');
		lexids[0].split(/\s*\|\s*/).forEach(function (id) {
			s_lexemes[id] = re;
		});
	}

	function ui_rule(node, rule) {
		// TAGS SP ANY
		var node_args = node.args;
		if (!node_args)
			throw SyntaxError(node.id+': missed TAGS list in the row '+node.srow);
		TAGS.lastIndex = 0;
		var tags = TAGS.exec(node_args);
		if (!tags || !tags[0])
			throw SyntaxError(node.id+': bad TAGS list in the row '+node.srow);
		SP.lastIndex = TAGS.lastIndex;
		SP.exec(node_args);
		ANY.lastIndex = SP.lastIndex;
		var any = ANY.exec(node_args);
		if (any) {
			var parser = (new ArgsParser(any[0], s_lexemes)),
			    args = parser.toString();
			if (!(args in args_parsers))
				args_parsers[args] = parser;
		} else
			var args = undefined;

		var sub = rule.add(tags[0].split(/\s*\|\s*/), args);
		if (node.children)
			node.children.forEach(function (snode) {
				switch (snode.id) {
				case 'rule':
				case 'children':
					ui_rule(snode, sub);
					break;
				default:
					var e = SyntaxError('not allowed node type: ['+snode.id+'] in the row '+snode.srow);
					e.ui = snode;
					throw e;
				}
			});
		return sub;
	}

	var self = this;

	ui.children.forEach(function (node) {
		switch (node.id) {
		case 'lex':
			ui_lex(node);
			break;

		case 'rule':
			ui_rule(node, common_rules);
			break;

		case 'root-rule':
			ui_rule(node, root_rules)
			break;

		default:
			throw SyntaxError('not allowed scheme root node type: ['+node.id+'] in the row '+node.srow);
		}
	});

	for (var id in args_parsers)
		args_parsers[id] = args_parsers[id].toFunction(s_lexemes);

	s_lexemes = 0;

	common_rules.enum(function (rule) {
		rule.args = args_parsers[rule.args];
	});
	root_rules.enum(function (rule) {
		rule.args = args_parsers[rule.args];
	});
}

UiScheme.prototype = {
	process: function (ui_root) {
		var common_rules = this.common_rules;

		function match(up_rules, ui, matched, optional) {
			var tag = ui.id,
			    has_matches = 0;
			up_rules.forEach(function (rule) {
				var rules = rule.rules;
				if (!rules)
					return has_matches = optional;
				for (var i = 0, n = rules.length; i < n; ++i) {
					var rule = rules[i];
					if (!rule.match(tag))
						continue;

					if (rule.args) {
						//if (ui.args === undefined)
							//throw SyntaxError('missing node('+tag+') arguments in row '+ui.srow);
						if (typeof ui.args !== 'object') {
							ui.args = rule.args(ui.args || '');
							if (ui.args.error) {
								var e = SyntaxError('arguments syntax error in row '+ui.srow);
								e.ui = ui;
								throw e;
							}
						}
					}
					has_matches = 1;
					matched.push(rule);
				}
			});
			return has_matches;
		}

		function walk(rules, ui) {
			var tag = ui.id;

//			if (!ui.children)
//				return typeof ui.args !== 'string'; // arguments is not parsed

			// 1. Если детей нет, то узел проверку прошёл

			// 2. Для каждого из детей узла провести эту процедуру

			// 2.1 поискать среди цепочек
			// 2.1.1 если цепочки не сработали, то этот узел не на своём месте
			// 2.1.2 сработавшие цепочки сохранить
			// 2.2 поискать общие правила
			// 2.2.1 сработавшие общие правила добавить в цепочки

			if (!ui.children)
				return 1;

			var children = ui.children;
			for (var i = 0, n = children.length; i < n; ++i) {
				var child = children[i],
				    matched = [];
				if (!match(rules, child, matched)) {
					var e = Error('invalid ui-node "'+child.id+'" in row '+child.srow);
					e.ui = child;
					throw e;
				}
				match([common_rules], child, matched, 1);

				walk(matched, child);
			}
		}

		walk([this.root_rules], ui_root);
		return ui_root;
	}
};

module.exports = UiScheme;
