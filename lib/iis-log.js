var W3CLogs = (function(){
	var tool, configuration, W3CLogs;

	var configPath = "C:\\Windows\\System32\\inetsrv\\config\\applicationHost.config";

	var fs = require('fs');

	var xml2js = require('xml2js').parseString;
	var watcher = require('chokidar');
	var _ = require('underscore');
	var fileWatcher;
	var watchNewFile;

	var siteDetails = {};
	var logData={};
	var logDataToExport=[];
	var logFiles = []
	var logFilesStats = []
	var headers = []

	var siteToMonitor = {};
	siteToMonitor.name = "Default Web Site";

	var returnObj = {};

	var eventForChange = null;
	var eventToGetDifference = null;

	tool = {
		loadConfig: function(callback){
			fs.open(configPath, 'r',function(errO, fd){
				if(errO){
					callback(errO)
					return;
				}
				else{
					fs.readFile(configPath, function(errR, data){
						if(errR){
							callback(errR)
							return;
						}
						else{
							configuration = data.toString('utf8');
							xml2js(configuration, function(errX, configJson){
								if(errX){
									callback(errX);
									return;
								}
								else{
									configuration = configJson;
								}	
							})
							callback(undefined);
							return;
						}
					})
				}
			});
		},
		getSiteLogPath: function(){
			if(configuration){
				var sites = configuration.configuration["system.applicationHost"][0].sites[0];
				siteDetails.defaultLogFilePath = sites.siteDefaults[0].logFile[0].$.directory;
				var logFilePathDefined = false;
				for(var i = 0; i < sites.site.length; i++){
					if(sites.site[i].$.name == siteToMonitor.name){
						siteDetails.id = sites.site[i].$.id;
						if(sites.site[i].logFile){
							siteDetails.logFile = sites.site[i].logFile[0].$.directory;
							logFilePathDefined = true;
						}
					}
				}
				if(!logFilePathDefined){
					siteDetails.logFile = siteDetails.defaultLogFilePath;
				}

				for(var i in siteDetails){
					siteDetails[i] = siteDetails[i].replace("%SystemDrive%", process.env.systemdrive);
					siteDetails[i] = siteDetails[i].replace("%SystemRoot%", process.env.systemroot);
				}

				siteDetails.logFile = siteDetails.logFile + "\\W3SVC" + siteDetails.id.toString();
			}
		},
		GetData: function(){
			returnObj = {};
			logDataToExport = [];
			logFiles.forEach(function(file){
				//console.log(logData[file]);
				var logsInFile = logData[file].split('\r\n');
				logsInFile.forEach(function(line){
					//header row
					if(line.indexOf('#') == 0){
						var headerName = line.substr(1,line.indexOf(":")-1);
						if(headerName == "Fields"){
							var fieldsArr = line.substr(line.indexOf(":") + 2).split(' ');
							fieldsArr.forEach(function(field){
								var headerExists = false;
								headers.forEach(function(header){
									if(header == field){
										headerExists = true;
									}
								});
								if(!headerExists){
									headers.push(field);
								}
							});
						}
					}
					else{
						//data row
						var lineData = line.split(' ');
						if(lineData.length > 1){
							logDataToExport.push(lineData);
						}
					}
				});
			});
			returnObj.headers = headers;
			returnObj.data = logDataToExport;
			return returnObj;
		},
		AppendDataFromFile: function(data){
			var logsInFile = data.split('\r\n');
			logsInFile.forEach(function(line){
				if(line.indexOf('#') == 0){
					var headerName = line.substr(1,line.indexOf(":")-1);
					if(headerName == "Fields"){
						var fieldsArr = line.substr(line.indexOf(":") + 2).split(' ');
						fieldsArr.forEach(function(field){
							var headerExists = false;
							headers.forEach(function(header){
								if(header == field){
									headerExists = true;
								}
							});
							if(!headerExists){
								headers.push(field);
							}
						});
					}
				}
				else{
					//data row
					var lineData = line.split(' ');
					if(lineData.length > 1){
						logDataToExport.push(lineData);
					}
				}
			});
			returnObj.headers = headers;
			returnObj.data = logDataToExport;
			return returnObj;
		},
		readLogs:function(callback){
			if(!siteDetails.logFile){
				throw "Log path not defined or not found";
			}
			fs.readdir(siteDetails.logFile, function(err, files){
				if(err){
					callback(err);
					return;
				}
				
				files.sort(function(a, b) {
					return fs.statSync(siteDetails.logFile + '\\' + a).mtime.getTime() - 
							fs.statSync(siteDetails.logFile + '\\' + b).mtime.getTime();
				}).reverse();
				logFiles = files;
				var c = 0;
				files.forEach(function(file){
					logFilesStats.push({ 
						file: file, 
						stats: fs.statSync(siteDetails.logFile + '\\' + file) 
					});
					c++;
					fs.readFile(siteDetails.logFile + '\\' + file,'utf-8',function(errf,logs){
			            if (errf){
			            	callback(errf);
							return;
			            }
			            logData[file]=logs;
			            if (0===--c) {
			            	tool.GetLogData();
			            	tool.addWatcher();
			                callback(undefined);
			            }
			        });
				})
			});
		},
		processLogs: function(callback){
			if(Object.getOwnPropertyNames(logData).length == 0){
				callback("No logs found");
				return;
			}

			callback(undefined);
		},
		getLogs: function(callback){
			tool.readLogs(function(err){
				if(err){
					callback(err);
					return;
				}
				tool.processLogs(function(err){
					if(err){
						callback(err);
						return;
					}
					callback(undefined);
				});
			})
		},
		GetLogData: function(){
			process.nextTick(function(){
				tool.GetData();
			})
		},
		processNewFiles: function(fileName){
			var statsLst = _.filter(logFilesStats, function(stats){
				if(stats.file == fileName){
					return true;
				}
			});
			var statsForCurrentFile;
			if(statsLst.length > 0){
				statsForCurrentFile = statsLst[0];
			}

			//new file
			if(!statsForCurrentFile){
				logFilesStats.push({ 
					file: fileName, 
					stats: fs.statSync(siteDetails.logFile + '\\' + fileName) 
				});
				logData[fileName] = "";
			}

			fs.readFile(siteDetails.logFile + '\\' + fileName,'utf-8',function(errf,logs){
	            if (errf){
	            	//callback(errf);
					return;
	            }
	            var difference = logs.replace(logData[fileName],"");
	            logData[fileName]=logs;
	            tool.AppendDataFromFile(difference);
	            if(eventForChange && typeof eventForChange == 'function' ){
	            	eventForChange(returnObj);
	            }
	            if(eventToGetDifference && typeof eventToGetDifference == 'function' ){
	            	eventToGetDifference(difference);
	            }
	            console.log("after appending or adding", returnObj.data.length);
	        });
		},
		addWatcher: function(){
			watchNewFile = watcher.watch(siteDetails.logFile);
			watchNewFile
				.on('add', function(path){
					var fileName = path.replace(siteDetails.logFile + "\\",'');
					//console.log(path, fileName);
					//add to log files list
					logFiles.push(fileName);
					//add filewatcher on new file
					fileWatcher.add(path);
					//process the new file
					tool.processNewFiles(fileName);
				});

			var newFilePathArr = [];
			logFiles.forEach(function(file){
				newFilePathArr.push(siteDetails.logFile + "\\" + file);
			});

			fileWatcher = watcher.watch(newFilePathArr);
			fileWatcher
				.on('change', function(path, stats){
					var fileName = path.replace(siteDetails.logFile + "\\",'');
					console.log(path, path.replace(siteDetails.logFile,''), stats);
					tool.processNewFiles(fileName);
				});
		}	
	}

	var W3CLogs = function(siteName, logPath, callback){

		if(siteName){
			siteToMonitor.name = siteName;	
		}
		else{
			throw "Sitename not provided";
		}
		if(logPath){
			if(typeof logPath == 'function'){
				callback = logPath;
			}
			else{
				siteDetails.logFile = logPath;
			}
		}
		process.nextTick(function(){
			tool.loadConfig(function(err){
				if(err){
					throw err;
				}
				if(!siteDetails.logFile){
					tool.getSiteLogPath();	
				}
				tool.getLogs(callback);
			});
		});
	}


	W3CLogs.prototype.onChange = function(event){
		eventForChange = event;
	}

	W3CLogs.prototype.GetLogData = function(){
		tool.GetLogData();
	}

	W3CLogs.prototype.difference = function(event){
		eventToGetDifference = event;
	}
	

	W3CLogs.prototype.getData = function(){
		return returnObj;
	}

	return W3CLogs;
})();

module.exports = W3CLogs;