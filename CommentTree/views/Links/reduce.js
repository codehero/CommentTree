function (key, values, rereduce){
	var sum = 0;
	for(var i = 0; i < values.length; ++i)
		sum += values[i][1];

	return [null, sum];
}
