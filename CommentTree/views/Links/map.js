function(doc){
	/* All objects to be organized in the tree must have this id member. */
	if("commentTree.id" in doc){
		/* Make ourselves known in the list. */
		emit(doc["commentTree.id"], [null, 0]);

		/* If this is a subnode, then it will have a parent. */
		if("commentTree.parent" in doc)
			emit(doc["commentTree.parent"], [doc["commentTree.id"], 1]);
	}
}
