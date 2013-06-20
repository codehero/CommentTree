var util = require("util");
var couchdb = require("couchdb-api");
var fs = require("fs");
var CommentTree = require("./comments.js");

if(process.argv.length < 3){
	console.error("Must specify configuration file.");
	process.exit(1);
}

var CONFIG = JSON.parse(fs.readFileSync(process.argv[2]));

var client = couchdb.srv("http://"+ CONFIG.host +":"+ CONFIG.port);
client.auth = CONFIG.user +":"+ CONFIG.password;
var cdb = client.db(CONFIG.dbName);

var treeDB = new CommentTree.CommentTree(cdb);
/*
treeDB.addNode({"test":2}, 10, function(err, newID){
	if(err){
		util.debug("ADD NODE ERROR: " + JSON.stringify(err));
		return;
	}
	*/

	treeDB.getTree([10], -1, function(err, data){
		if(err){
			util.debug("GET TREE ERROR: " + JSON.stringify(err));
			return;
		}

		console.log("RAW ANSWER" + JSON.stringify(data));
		console.log("TREE ANSER" + JSON.stringify(CommentTree.makeTree(data)));
	});
//});
