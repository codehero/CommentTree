var util = require("util");
var fs = require("fs");

/** @brief  */
var CommentTree = function(cdb, cfg){
	var ct = this;
	ct.cfg = cfg;
	ct._cdb = cdb;
	/* Begin listening for changes and for when the next trigger to execute. */
	ct._cdb.info(function(err, data){
		if(err){
			/* TODO */
			util.debug("INFO error " + JSON.stringify(err));
		}
		else{

			/*  */
			ct._listenForChanges(data.update_seq);
		}
	});

	return this;
}

CommentTree.prototype.INFINITE_DEPTH = -1;

CommentTree.prototype._listenForChanges = function(last_seq){
	var ct = this;
	var opts = {
		"since":last_seq,
		"filter":"CommentTree/changesFilter",
		"feed":"continuous",
		"include_docs":true
	};

	ct._cdb.changes(opts, function(err, changeStream){
		changeStream.on("change", function(change){
			ct._onChange(change);
		});

		changeStream.on("end", function(){
			util.debug("CHANGESTREAM ENDED");
		});

		changeStream.on("error", function(err){
			util.debug("CHANGESTREAM ERROR: " + err);
		});

		changeStream.on("last", function(final_seq){
			util.debug("CHANGESTREAM final_seq " + final_seq);
			opts.since = final_seq;
			ct._listenForChanges(final_seq);
		});

	});
}

CommentTree.prototype._onChange= function(change){
	/* TODO update tree cache based on change. */
}

CommentTree.prototype._getTreeHelp = function(nodes, depth, appendCB, cb){
	var ct = this;

	/* TODO: Lookup tree in the local cache. */

	var ddoc = ct._cdb.ddoc("CommentTree");
	ddoc.view("Links").query(
		{
			"reduce" : false
		},
		nodes,
		function(err, result){
			if(err){
				cb(err);
				return;
			}

			var ret = [];
			var children = [];
			for(var i = 0; i < result.rows.length; ++i){
				var v = result.rows[i];
				/* If null, then one of the nodes. */
				if(v.value[0]){
					/* This is a child node.
					 * The parent node ID is the key. */
					children.push(v);
					ret.push([v.value[0], v.id, v.key]);
				}
			}
			appendCB(ret);

			if(depth && children.length)
				ct._getTreeHelp(children, depth > 0 ? depth - 1 : -1, appendCB, cb);
			else
				cb(null);
		}
	);
}

/** @brief This function obtains the tree structure for each root node in the
 * roots[] array by doing a BFS exploration from the root nodes.
 *  @param roots Numeric root node ids
 *  @param depth Maximum depth of tree to return. -1 or CommentTree.INFINITY to have no limit.
 * @return Array in the following format:
 * [
 * 	[nodeID, node._id, parentID]
 * 	....
 * ]
 * parentID may be null if this is the root.
 * 	*/
CommentTree.prototype.getTree = function(roots, depth, cb){
	var ct = this;

	/* TODO: Lookup tree in the local cache. */

	var ddoc = ct._cdb.ddoc("CommentTree");
	ddoc.view("Links").query(
		{
			"reduce" : false
		},
		roots,
		function(err, result){
			if(err){
				cb(err);
				return;
			}

			var ret = [];
			var children = [];
			for(var i = 0; i < result.rows.length; ++i){
				var v = result.rows[i];
				/* If null, then one of the roots. */
				if(null == v.value[0]){
					ret.push([v.key, v.id, null]);
				}
				else{
					/* This is a child node.
					 * The parent node ID is the key. */
					children.push(v.value[0]);
					ret.push([v.value[0], v.id, v.key]);
				}
			}

			if(depth && children.length){
				ct._getTreeHelp(children, depth > 0 ? depth - 1 : -1
				,function(arr){
					ret = ret.concat(arr);
				}
				,function(err){
					cb(err, ret);
				});
			}
		}
	);
}

/** @brief TODO Traverse from the given node all the way to the root.
 * This requires another map() */
CommentTree.prototype.getPath = function(endNode, cb){
	var ct = this;
}

CommentTree.prototype.addNode = function(data, parent, cb){
	var ct = this;

	/* Parent must be a numerical id. */
	if(isNaN(parent)){
		cb({"message" : "Parent id is non-numerical!"});
		return;
	}

	/* Verify that parent exists. */
	var ddoc = ct._cdb.ddoc("CommentTree");
	ddoc.view("Links").query(
		{
			"reduce" : false
			,"key" : parent
		},

		function(err, result){
			if(err){
				cb(err);
				return;
			}

			/* If no rows, no parent exists. */
			if(0 == result.rows.length && parent){
				cb({"message" : "Parent does not exist!"});
				return;
			}else{
			/* Add parent id. */
				data["commentTree.parent"] = parent;
			}

			/* Generate new comment id if it does not exist. */
			var newID = new Date().getTime();
			if(!("commentTree.id" in data))
				data["commentTree.id"] = newID;

			var doc = ct._cdb.doc();
			doc.body = data;

			doc.save(function(err, data){
				if(err){
					cb(err);
					return;
				}
				cb(null, newID);
			});
		}
	);
}

exports.makeTree = function(data){
	/* Sort the data array by numerical ID. Since non-root nodes are added by
	 * timestamp, we know that a node's ancestor must precede it in the array. */
	function comp(a, b){
		return a[0] - b[0];
	}

	util.debug(JSON.stringify(data));
	data.sort(comp);
	util.debug(JSON.stringify(data));

	var roots = {};
	var nodeMap = {};

	/* Add all the roots. */
	var lastKey = "";
	for(var idx = 0; idx < data.length; ++idx){
		var row = data[idx];
		var key = row[0] + "";
		if(key != lastKey){
			nodeMap[key] = {
				"data" : row
			};
			lastKey = key;
		}

		if(null == row[2])
			roots[key] = nodeMap[key];
		else{
			var parent = nodeMap[row[2] + ""];
			if(!parent)
				throw new Error("Database integrity error. Parent is newer than child.");
			if(!("children" in parent))
				parent.children = [];
			parent.children.push(nodeMap[key]);
		}
	}

	return roots;
}

exports.CommentTree = CommentTree;
