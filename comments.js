var couchdb = require("couchdb-api");

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

	var cdb = this._db;
	cdb.changes(opts, function(err, changeStream){
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

/** @brief This function obtains the tree structure for each root node in the
 * roots[] array.
 *  @param roots Numeric root node ids
 *  @param depth Maximum depth of tree to return. -1 or CommentTree.INFINITY to have no limit.
 * @return Array in the following format:
 * [
 * 	[nodeID, _id, parentID]
 * 	....
 * ]
 * 	*/
CommentTree.prototype.getTree = function(roots, depth, descending, cb){
	var ct = this;

	/* TODO: Lookup tree in the local cache. */

	var ddoc = cdb.ddoc("CommentTree");
	ddoc.view("Links").query(
		{
			"reduce" : false
			,"keys" : [roots]
			,"descending" : descending
		},
		function(err, result){
			if(err){
				cb(err);
				return;
			}

			var children = [];
			for(var i = 0; i < result.rows.length; ++i){
				var v = result.rows[i];
				/* If null, then one of the roots. */
				if(null == v[0]){
				}
				else{
					/* This is a child node. */
					children.push(v[0]);
				}
			}
		}
	);
}

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
	var ddoc = cdb.ddoc("CommentTree");
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
			if(0 == result.rows.length){
				cb({"message" : "Parent does not exist!"});
				return;
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

