# iis-log

Reads w3c format logs from the iis website.

accepts three parameters
1. site name (name of site in IIS)
2. LogPath (optional) (if provided, then this path is used directly, instead of finding path from the iis website name)
3. callback

We were having a requirement to write the iis logs in database and we do not have the option to modify the iis odbc component. so we end up writing this package.

example usage:

```
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
```

or

```
var data = ilogs.getData();
```