function(doc, req) {
	if("commentTree.id" in doc)
		return true;
	return false;
}
