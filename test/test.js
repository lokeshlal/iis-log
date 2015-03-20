var http = require("http");
var W3CLogs = require("../lib/iis-log");


var ilogs = new W3CLogs("Default Web Site", function(err){
    if(err){
      return;
    }
    //preload the data
    ilogs.GetLogData();
  });

ilogs.onChange(function(data){
  console.log("data after logs changed:", data.data.length);
}); 

ilogs.difference(function(data){
  console.log("difference after logs changed:", data);
}); 



var server = http.createServer(function(req, res) {
  var data = ilogs.getData();
  res.write("headers.." + data.data.length + ".." + data.headers);
  res.write("..data.." + data.data);
  res.end();
});
 
server.listen(8080);
console.log("Server is listening");