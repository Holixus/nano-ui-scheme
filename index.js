

var DefsLib = require('./lib/defs.js');

var TAGS = /([a-zA-Z0-9_-]+(?:\s*\|\s*[a-zA-Z0-9_-]+)*)|/g,
    ID = /([a-zA-Z0-9_-]+)|/g,
	SP = /\s+|/g,
	ANY = /(.+)|/g,
	LEXIDs = /([A-Za-z0-9_-]+(?:\s*\|\s*[A-Za-z0-9_-]+)*)|/g;

function Rule(tags, args) {
	this.tags = tags;
	this.args = args;
	this.argsStr = args;
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
	    defs = this.defs = new DefsLib(),
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
		defs.lex(lexids[0], any[0]);
		if (node.children)
			throw Error(node.id+': has children nodes in the row '+node.srow);
	}

	function def_seq(node, def) {
		if (!node.args)
			throw SyntaxError(node.id+': missed sequence text in the row '+node.srow);
		def.seq(node.args);
		if (node.children)
			throw Error(node.id+': has children nodes in the row '+node.srow);
	}
	function def_case(node, def) {
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
		//if (!any || !any[1])
			//throw SyntaxError(node.id+': missed case expression in the row '+node.srow);
		def['case'](tags[0], any && any[1] || '');
		if (node.children)
			throw Error(node.id+': has children nodes in the row '+node.srow);
	}

	function ui_def(node) {
		var node_args = node.args;
		if (!node_args)
			throw SyntaxError(node.id+': missed ID in the row '+node.srow);
		ID.lastIndex = 0;
		var id = ID.exec(node_args);
		if (!id || !id[0])
			throw SyntaxError(node.id+': bad ID in the row '+node.srow);
		if (ID.lastIndex < node_args.length)
			throw SyntaxError(node.id+': extra symbols after ID in the row '+node.srow);

		var def = defs.def(id[1]);

		if (node.children)
			node.children.forEach(function (snode) {
				switch (snode.id) {
				case 'seq':
					def_seq(snode, def);
					break;
				case 'case':
					def_case(snode, def);
					break;
				default:
					throw SyntaxError('not allowed node type: ['+snode.id+'] in the row '+snode.srow);
				}
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
		if (any && any[0]) {
			var parser = defs.seq(any[0]),
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
					throw SyntaxError('not allowed node type: ['+snode.id+'] in the row '+snode.srow);
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

		case 'def':
			ui_def(node);
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
		args_parsers[id] = args_parsers[id].toFunction();

	common_rules.enum(function (rule) {
		rule.args = args_parsers[rule.args];
	});
	root_rules.enum(function (rule) {
		rule.args = args_parsers[rule.args];
	});
}

UiScheme.prototype = {
	process: function (ui_root, validate) {
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
							var args = ui.args || '',
							    o = rule.args(args);
							if (o.error)
								throw SyntaxError('node ['+tag+'] arguments('+args+') error in the row '+ui.srow + '('+o.error.message+')');
							if (!validate)
								ui.args = o;
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

			if (!ui.children)
				return 1;

			var children = ui.children;
			for (var i = 0, n = children.length; i < n; ++i) {
				var child = children[i],
				    matched = [];
				if (!match(rules, child, matched))
					throw Error('invalid ui-node "'+child.id+'" in row '+child.srow);
				match([common_rules], child, matched, 1);

				walk(matched, child);
			}
		}

		walk([this.root_rules], ui_root);
		return ui_root;
	},

	toString: function () {
		var s = '';
		// lexemes
		var lexes = this.defs.lexemes;
		for (var id in lexes)
			s += 'lex '+id+' ' + lexes[id].toString().replace(/^\/(.*)\|\/g$/,'$1') + '\n';
		function rule2str(rule, indent, type, before) {
			if (!rule.rules)
				return;
			var sub_indent = indent + '\t';
			rule.rules.forEach(function (sub) {
				s += before + indent + type + ' ' + sub.tags.join('|');
				if (sub.argsStr)
					s += ' ' + sub.argsStr;
				s += '\n';
				rule2str(sub, sub_indent, 'rule', '');
			});
		}
		// common rules
		rule2str(this.common_rules, '', 'rule', '\n');
		// root rules
		rule2str(this.root_rules, '', 'root-rule', '\n');

		return s;
	}
};

module.exports = UiScheme;
