"use strict";
var start_time = null;
var end_time = null;
var results = "";

$(document).ready(function() {
	$("#Save-1").click(function() {
		if (document.getElementById('uploadedfile').files.length > 0) {
			start_time = document.querySelector('#start_time').value.length == 0? null : new Date(document.querySelector('#start_time').value);
			end_time = document.querySelector('#end_time').value.length == 0? null : new Date(document.querySelector('#end_time').value);

			if (start_time != null && end_time != null) {
				if (start_time >= end_time) {
					alert("End time cannot be earlier than start time.");
					document.getElementById("Next-1").disabled = true;
				}
				else{
					$("#Next-1").removeAttr("disabled");
				}
			}
			else{
				$("#Next-1").removeAttr("disabled");
			}
		}
		else{
			alert("Please select a file for analysis.");
			document.getElementById("Next-1").disabled = true;
		}
	});

	$("#Next-1").click(function() {
		execute();
		$('.ui.menu').find('.item').tab('change tab', '2');
	});
	$("#Next-2").click(function() {
		$('.ui.menu').find('.item').tab('change tab', '3');
	});

	$("#Back-2").click(function() {
		$('.ui.menu').find('.item').tab('change tab', '1');
	});
	$("#Back-3").click(function() {
		$('.ui.menu').find('.item').tab('change tab', '2');
	});
	$("#Back-4").click(function() {
		$('.ui.menu').find('.item').tab('change tab', '3');
	});

	$("#Download-1").click(function() {
		$('.ui.menu').find('.item').tab('change tab', '3-1');
	});
    
	$("#Download").click(function() {
		$('.ui.menu').find('.item').tab('change tab', '3-1');

		let data_ele = document.getElementsByName('data');
		for (let i = 0; i < data_ele.length; i++) {
			if (data_ele[i].checked) {
				data_ele = data_ele[i].value;
				break;
			}
		}
        if (typeof(data_ele) == "object") {
            data_ele = "missing_and_faulty";
        }

		let days_ele = document.getElementsByName('days');
		for (let i = 0; i < days_ele.length; i++) {
			if (days_ele[i].checked) {
				days_ele = days_ele[i].value;
				break;
			}
		}
        if (typeof(days_ele) == "object") {
            days_ele = "all_days";
        }
        
		let hours_ele = document.getElementsByName('hours');
		for (let i = 0; i < hours_ele.length; i++) {
			if (hours_ele[i].checked) {
				hours_ele = hours_ele[i].value;
				break;
			}
		}
        if (typeof(hours_ele) == "object") {
            hours_ele = "all_hours";
        }
	});
});

/**
 * Class to represent the entire CSV file.
 */
class FileInfo {
    constructor() {
        // Constants
        this.fileName =  undefined;
        this.numDataPoints = 0;
        this.numDataPointsRP = 0; // rush, peak hour
        this.numDataPointsNP = 0; // non-rush, peak hour
        this.numDataPointsRN = 0; // rush, non-peak hour
        this.numDataPointsNN = 0; // non-rush, non-peak hour
        this.zoneId = 0;
        this.laneNumber = 0;
        this.laneId = 0;
    
        // Measurements
        this.fileStartTime = 0;

        // Outcomes
        this.missingData = 0;
        this.missingSpeed = 0;
        this.missingVol = 0;
        
        this.faultyCount1 = 0;
        this.faultyCount1RP = 0;
        this.faultyCount1NP = 0;
        this.faultyCount1RN = 0;
        this.faultyCount1NN = 0;
  
        this.faultyCount2 = 0;
        this.faultyCount2RP = 0;
        this.faultyCount2NP = 0;
        this.faultyCount2RN = 0;
        this.faultyCount2NN = 0;
        
        this.faultyCount3 = 0;
        this.faultyCount3RP = 0;
        this.faultyCount3NP = 0;
        this.faultyCount3RN = 0;
        this.faultyCount3NN = 0;

        this.zeroCount3 = 0;
        this.zeroCount3RP = 0;
        this.zeroCount3NP = 0;
        this.zeroCount3RN = 0;
        this.zeroCount3NN = 0;
        
        this.oneCount3 = 0;
        this.oneCount3RP = 0;
        this.oneCount3NP = 0;
        this.oneCount3RN = 0;
        this.oneCount3NN = 0;

        this.faults = new Array();
        this.error = undefined;
    }
}

/**
 * Class to represent a CSV line, which is also an individual lane sensor data point.
 */
class Line {
    constructor(lineSplit) {
        if (typeof(lineSplit) === 'string') {
            lineSplit = lineSplit.split(",");
        }

        this.zoneId = Number(lineSplit[0]);
        this.laneNumber = Number(lineSplit[1]);
        this.laneId = Number(lineSplit[2]);
        this.measurementStart = lineSplit[3];
        this.date = new Date(lineSplit[3]);
        this.volume = lineSplit[5] === "" ? undefined : Number(lineSplit[5]);
        this.speed = lineSplit[4] === "" ? undefined : Number(lineSplit[4]);
        this.occupancy = Number(lineSplit[6]);
        this.quality = lineSplit[7];

        this.flowRate = this.volume * 60.0;
    }
}

/**
 * Class to store faults found in the sensor.
 */
class Fault {
    constructor(timeStamp, reason) {
        this.timeStamp = timeStamp;
        this.reason = reason;
    }

	toString() {
		return this.timeStamp + ", " + this.reason;
	}
}

/**
 * Function that is executed upon "Next" HTML button click.
 */
function execute() {
    const fileList = document.getElementById('uploadedfile').files;
	readFileList(fileList, document, processText);
}

/**
 * Function to begin reading the list of files and converting them to Arrays of Line objects for processing.
 * @param {Array} fileList Array of files from the HTML uploadedfile element 
 * @param {Document} document HTML Document to write results to
 * @param {Function} _callback processText function is passed here to continue after async file read
 */
function readFileList(fileList, document, _callback) {
    var reader = new FileReader();
    // fileText: Array of Line Arrays representing the CSV files
    // fileInfoArr: Array of FileInfo objects storing document data
    var fileText = new Array();
    var fileInfoArr = new Array();

    /**
     * Recursive function to read in files in the file list one-by-one, before being processed async by the callback function.
     * @param {Number} index Index of the file on the file array being read
     */
    function readFile(index) {
        if (index >= fileList.length) {
            _callback(fileText, fileInfoArr, document);
        }

        var file = fileList[index];

        if (file) {
            fileInfoArr[index] = new FileInfo();
            fileInfoArr[index].fileName = file.name;
        }

        reader.onloadend = function(event) {
            var text = event.target.result;
            var linesArr = new Array();
            
            var fileLines = text.split(/\r\n|\n/);
            fileLines.splice(0, 1);

            fileLines.every(line => {
                if (line != "") {
                    let l = new Line(line);
                    linesArr.push(l);
                    
                    if (fileInfoArr[index].fileStartTime == 0 || fileInfoArr[index].fileStartTime === undefined) {
                        fileInfoArr[index].fileStartTime = l.date;
                    }
                    return true;
                }
                return false;
            });

            fileText[index] = linesArr;
            
            readFile(index + 1);
        }

        if (file) {
            reader.readAsText(file);
        }
    }

    readFile(0);
}

/**
 * Function used as a callback to process text after extraction from files.
 * @param {Array} fileText Array of Line Arrays representing the CSV files
 * @param {Array} fileInfoArr Array of FileInfo objects storing document data
 * @param {Document} document HTML Document to write results to
 */ 
function processText(fileText, fileInfoArr, document) {
    // currLine: stores the line that is currently being processed in each file, used for concurrent time processing across multiple files
    var currLine = new Array();
    let numFiles = fileText.length;

    for (let i = 0; i < numFiles; i ++) {
        currLine[i] = 0;
    }

    /* 
    * Function to determine if all file lines have been processed and the line-by-line processing can terminate.
    */
    function finished() {
        let finished = true;
        for (let j = 0; j < numFiles; j ++) {
            finished = finished && (currLine[j] >= fileText[j].length ? true : false);
        }
        return finished;
    }

    /**
    * Function to return an Array with the indices of the files with the earliest measurement times for immediate processing.
    */     
    function earliestDate() {
        let earliestDate = undefined;
        let earliestIndex = 0;

        // indicesArray: Array to store all file indices with the earliest measurement time
        let indicesArray = new Array();

        while(earliestIndex < numFiles && fileText[earliestIndex][currLine[earliestIndex]] == undefined) {
            earliestIndex ++;
        }

        if (earliestIndex > numFiles) {
            alert("Error! Data was not found.");
        }

        indicesArray = [earliestIndex];
        earliestDate = fileText[earliestIndex][currLine[earliestIndex]].date;

        // Finding the earliest measurement time out of the remaining files, j represents file index
        for (let j = earliestIndex + 1; j < numFiles; j ++) {
            if (currLine[j] < fileText[j].length && fileText[j][currLine[j]].date < earliestDate) {
                earliestDate = fileText[j].date;
                indicesArray = [j];
            }
            else if (currLine[j] < fileText[j].length && fileText[j][currLine[j]].date == earliestDate) {
                indicesArray.push(j);
            }
        }

        return indicesArray;
    }

    // Line-by-line processing of the files starts here
    while(!finished()) {
        let indicesArray = earliestDate();

        for (let i = 0; i < indicesArray.length; i ++) {
            let fileIndex = indicesArray[i];

            processLine(fileText[fileIndex], currLine[fileIndex], fileInfoArr[fileIndex]);
            currLine[fileIndex] += 1;
        }
    }

    let info = fileInfoArr[0];
    let exclusionCount = (info.zeroCount3 + info.oneCount3);
    let missingRate = info.faultyCount1/info.numDataPoints;
    let faultyRate = (info.faultyCount2 + info.faultyCount3)/(info.numDataPoints - info.faultyCount1);

    let eval_res = document.querySelector('#evaluation'); //changed
    //let file_info = document.querySelector('#file_info'); Depreciated
    //let faults = document.querySelector('#faults'); depreciated

    eval_res.innerText = "Evaluation Results: ";
	// Display percentage of missing 
    // TODO: change formula for missing/f rate
	document.querySelector('#m').innerText = info.numDataPoints == 0 ? "Total Missing/Faulty Rate: NA" : "Total Missing/Faulty Rate: " + Math.round(info.faultyCount1 / info.numDataPoints * 10000)/100 + "% (" + info.faultyCount1 + " / " + info.numDataPoints + " time intervals)";
	document.querySelector('#mpc').innerText = info.numDataPointsRP == 0 ? "NA" : Math.round(info.faultyCount1RP / info.numDataPointsRP * 10000)/100 + '%';
	document.querySelector('#mnc').innerText = info.numDataPointsRN == 0 ? "NA" : Math.round(info.faultyCount1RN / info.numDataPointsRN * 10000)/100 + '%';
	document.querySelector('#mpn').innerText = info.numDataPointsNP == 0 ? "NA" : Math.round(info.faultyCount1NP / info.numDataPointsNP * 10000)/100 + '%';
	document.querySelector('#mnn').innerText = info.numDataPointsNN == 0 ? "NA" : Math.round(info.faultyCount1NN / info.numDataPointsNN * 10000)/100 + '%';

	// Display percentage of faults
	document.querySelector('#f').innerText = (info.numDataPoints - info.faultyCount1) == 0 ? "Faulty data: NA" : "Faulty data: " + Math.round((info.faultyCount2 + info.faultyCount3) / (info.numDataPoints - info.faultyCount1) * 10000)/100 + "% (" + (info.faultyCount2+info.faultyCount3) + " / " + (info.numDataPoints-info.faultyCount1) + " recorded datapoints)";
	document.querySelector('#fpc').innerText = (info.numDataPointsRP - info.faultyCount1RP) == 0 ? "NA" : Math.round((info.faultyCount2RP + info.faultyCount3RP) / (info.numDataPointsRP - info.faultyCount1RP) * 10000)/100 + '%';
	document.querySelector('#fnc').innerText = (info.numDataPointsRN - info.faultyCount1RN) == 0 ? "NA" : Math.round((info.faultyCount2RN + info.faultyCount3RN) / (info.numDataPointsRN - info.faultyCount1RN) * 10000)/100 + '%';
	document.querySelector('#fpn').innerText = (info.numDataPointsNP - info.faultyCount1NP) == 0 ? "NA" : Math.round((info.faultyCount2NP + info.faultyCount3NP) / (info.numDataPointsNP - info.faultyCount1NP) * 10000)/100 + '%';
	document.querySelector('#fnn').innerText = (info.numDataPointsNN - info.faultyCount1NN) == 0 ? "NA" : Math.round((info.faultyCount2NN + info.faultyCount3NN) / (info.numDataPointsNN - info.faultyCount1NN) * 10000)/100 + '%';

	file_info.innerHTML = "<b>Zone ID</b>: " + info.zoneId + ", <b>Lane number</b>: " + info.laneNumber + ", <b>Number of time intervals</b>: " + info.numDataPoints;
	if (start_time != null && end_time != null) {
		file_info.innerHTML = "<b>Zone ID</b>: " + info.zoneId + ", <b>Lane number</b>: " + info.laneNumber + ", <b>Time frame</b>: from " + start_time + ' to ' + end_time + ", <b>Number of time intervals</b>: " + info.numDataPoints;
	}
	else if (start_time != null) {
		file_info.innerHTML = "<b>Zone ID</b>: " + info.zoneId + ", <b>Lane number</b>: " + info.laneNumber + ", <b>Time frame</b>: from " + start_time + ", <b>Number of time intervals</b>: " + info.numDataPoints;
	}
	else if (end_time != null) {
		file_info.innerHTML = "<b>Zone ID</b>: " + info.zoneId + ", <b>Lane number</b>: " + info.laneNumber + ", <b>Time frame</b>: to " + end_time + ", <b>Number of time intervals</b>: " + info.numDataPoints;
	}

    if (info.numDataPoints == 0) {
		eval_res.innerText += " The selected date range is not within the range of data.\n";
        alert("The selected date range is not within the range of data, please go back and select another date range.");
        if (start_time != null && end_time != null) {
            file_info.innerHTML = "<b>Time frame</b>: from " + start_time + ' to ' + end_time;
        }
        else if (start_time != null) {
            file_info.innerHTML = "<b>Time frame</b>: from " + start_time;
        }
        else if (end_time != null) {
            file_info.innerHTML = "<b>Time frame</b>: to " + end_time;
        }
    }
    else if (missingRate >= 0.25 || faultyRate >= 0.3) {
		eval_res.innerText += " the sensor should be replaced/maintained.\n";
    }
    else if (missingRate >= 0.05 || faultyRate >= 0.05) {
        if ((info.faultyCount1RP + info.faultyCount1NP)/(info.numDataPointsRP + info.numDataPointsNP) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else if ((info.faultyCount1RN + info.faultyCount1NN)/(info.numDataPointsRN + info.numDataPointsNN) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else if ((info.faultyCount1RP + info.faultyCount1RN)/(info.numDataPointsRP + info.numDataPointsRN) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else if ((info.faultyCount1NP + info.faultyCount1NN)/(info.numDataPointsNP + info.numDataPointsNN) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else if ((info.faultyCount2RP + info.faultyCount2NP + info.faultyCount3RP + info.faultyCount3NP)/(info.numDataPointsRP + info.numDataPointsNP - info.faultyCount1RP - info.faultyCount1NP - info.zeroCount3RP - info.zeroCount3NP - info.oneCount3RP - info.oneCount3NP) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else if ((info.faultyCount2RN + info.faultyCount2NN + info.faultyCount3RN + info.faultyCount3NN)/(info.numDataPointsRN + info.numDataPointsNN - info.faultyCount1RN - info.faultyCount1NN - info.zeroCount3RN - info.zeroCount3NN - info.oneCount3RN - info.oneCount3NN) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else if ((info.faultyCount2RP + info.faultyCount2RN + info.faultyCount3RP + info.faultyCount3RN)/(info.numDataPointsRP + info.numDataPointsRN - info.faultyCount1RP - info.faultyCount1RN - info.zeroCount3RP - info.zeroCount3RN - info.oneCount3RP - info.oneCount3RN) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else if ((info.faultyCount2NP + info.faultyCount2NN + info.faultyCount3NP + info.faultyCount3NN)/(info.numDataPointsNP + info.numDataPointsNN - info.faultyCount1NP - info.faultyCount1NN - info.zeroCount3NP - info.zeroCount3NN - info.oneCount3NP - info.oneCount3NN) >= 0.25) {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
        else  {
            eval_res.innerText += " the sensor should be replaced/maintained.\n";
        }
    }
    else{
        eval_res.innerText += " the sensor is in good condition.\n";
    }

    let faults_out = "";
    let display_lines = 2000; // Not capping the number of displayed errors significantly increases the runtime of the program
	for (let i = 0; i < info.faults.length; i ++) {
		if (i < display_lines) {
            faults_out += info.faults[i].toString() + "\n";
        }
        results += info.faults[i].toString() + "\n";
	}
    faults.innerText = faults_out;
}

/**
 * @param {Array} lineArray Line Array representing the CSV file being analyzed
 * @param {number} lineIndex int representing the line being analyzed in the lineArray
 * @param {FileInfo} fileInfo FileInfo object storing document data
 */
function processLine(lineArray, lineIndex, fileInfo) {
    let line = lineArray[lineIndex];
    let date = new Date(line.date);

    // Quits line processing if it is not in the date range
    if (!dateInRange(date)) {
        return;
    }
    
    var prevTime = 0;
    if (lineIndex > 0) {
        prevTime = lineArray[lineIndex - 1].date;
    }

    // Finds and records number of missing data blocks
    // Does not count Daylight Savings Data Override as an error
    if (prevTime != 0 && date - prevTime > 60000 && line.measurementStart != "2021-11-07T01:00:00-05:00") {
        //fileInfo.missingData += ((date - prevTime) / 60000) - 1;

        let i = new Date(prevTime);
        i = new Date(i.setMinutes(i.getMinutes() + 1));

        for (i; i < date; i = new Date(i.setMinutes(i.getMinutes() + 1))) {
            const rushDay = isRushDay(i);
            const peakHour = isPeakHour(i);
            fileInfo.faults.push(new Fault(i.toString(), "Stage 1, Missing Interval"));
            
            fileInfo.numDataPoints ++;
            fileInfo.faultyCount1 ++;
            if (rushDay && peakHour) {
                fileInfo.numDataPointsRP ++;
                fileInfo.faultyCount1RP ++;
            }
            else if (rushDay) {
                fileInfo.numDataPointsRN ++;
                fileInfo.faultyCount1RN ++;
            }
            else if (peakHour) {
                fileInfo.numDataPointsNP ++;
                fileInfo.faultyCount1NP ++;
            }
            else{
                fileInfo.numDataPointsNN ++;
                fileInfo.faultyCount1NN ++;
            }
        }
    }

    const rushDay = isRushDay(date);
    const peakHour = isPeakHour(date);

    fileInfo.numDataPoints ++;
    if (rushDay && peakHour) {
        fileInfo.numDataPointsRP ++;
    }
    else if (rushDay) {
        fileInfo.numDataPointsRN ++;
    }
    else if (peakHour) {
        fileInfo.numDataPointsNP ++;
    }
    else{
        fileInfo.numDataPointsNN ++;
    }
    
    // prevent zoneId, laneNumber, laneId from changing mid-file
    if (!checkIdError(fileInfo, line.zoneId, line.laneNumber, line.laneId)) {
        return;
    }

    var faulty = false;
    var reason = "";

    // check to ensure all sppeed and volume data is present
    if (line.volume === undefined) {
        fileInfo.missingVol ++;
        faulty = true;
        reason = "Stage 1, Missing Volume Data";
    }
    else if (line.speed === undefined && line.volume != 0) {
        fileInfo.missingSpeed ++;
        faulty = true;
        reason = "Stage 1, Missing Speed Data";
    }

    if (faulty) {
        fileInfo.faults.push(new Fault(new Date(line.measurementStart), reason));
        fileInfo.faultyCount1 ++;
        if (rushDay && peakHour) {
            fileInfo.faultyCount1RP ++;
        }
        else if (rushDay) {
            fileInfo.faultyCount1RN ++;
        }
        else if (peakHour) {
            fileInfo.faultyCount1NP ++;
        }
        else{
            fileInfo.faultyCount1NN ++;
        }
        return;
    }
    
    faulty = false;
    reason = "";

    // Rule 1
    if (rushDay && peakHour) { 
        if (line.flowRate > 2300) {
            faulty = true;
            reason = "Stage 2, rule1";
        }
    }
    // Rule 2
    else if (rushDay && !peakHour) { 
        if (line.flowRate > 1120) {
            faulty = true;
            reason = "Stage 2, rule2";
        }
    }
    // Rule 3
    else if (!rushDay && peakHour) { 
        if (line.flowRate > 1910) {
            faulty = true;
            reason = "Stage 2, rule3";
        }
    }
    // Rule 4
    else { 
        if (line.flowRate > 975) {
            faulty = true;
            reason = "Stage 2, rule4";
        }
    }

    // Rule 5
    if (line.speed > 110) { 
        faulty = true;
        reason += "Stage 2, rule5";
    }

    if (faulty) {
        fileInfo.faultyCount2 ++;
        fileInfo.faults.push(new Fault(new Date(line.measurementStart), reason));

        if (rushDay && peakHour) {
            fileInfo.faultyCount2RP ++;
        }
        else if (rushDay) {
            fileInfo.faultyCount2RN ++;
        }
        else if (peakHour) {
            fileInfo.faultyCount2NP ++;
        }
        else{
            fileInfo.faultyCount2NN ++;
        }
        return;
    }
    
    const speed = line.speed;
    const flowRate = line.flowRate;
    const volume = line.volume;
    const zone0 = (volume < 2);
    const zone1 = (15.2*speed-242-flowRate >= 0) && (-176.8*speed+12913.3-flowRate >= 0) && (-72*speed+4063.2-flowRate <= 0);
    const zone2 = (15.8*speed+263.4-flowRate >= 0) && (-167.4*speed+12247.8-flowRate >= 0) && (14.9*speed-219.5-flowRate <= 0) && (-133*speed+7248-flowRate <= 0) && (247*speed-11386.9-flowRate >= 0);
    const zone3 = (15.7*speed+1215.2-flowRate >= 0) && (-259.5*speed+12309.4-flowRate >= 0) && (17.2*speed+270-flowRate <= 0) && (59.1*speed+217.7-flowRate >= 0);
    const zone4 = (33.6*speed+408.1-flowRate >= 0) && (-109.1*speed+8778.5-flowRate >= 0) && (17.8*speed+143.1-flowRate <= 0) && (-676.9*speed+29852.3-flowRate <= 0);

    if (!zone0 && !zone1 && !zone2 && !zone3 && !zone4) { // faulty data
        fileInfo.faultyCount3 ++;
        fileInfo.faults.push(new Fault(new Date(line.measurementStart), "Stage 3, data does not fit any zone"));

        if (rushDay && peakHour) {
            fileInfo.faultyCount3RP ++;
        }
        else if (rushDay) {
            fileInfo.faultyCount3RN ++;
        }
        else if (peakHour) {
            fileInfo.faultyCount3NP ++;
        }
        else{
            fileInfo.faultyCount3NN ++;
        }
    }
    else if (zone0) {
        if (volume == 0) {
            fileInfo.zeroCount3 ++;

            if (rushDay && peakHour) {
                fileInfo.zeroCount3RP ++;
            }
            else if (rushDay) {
                fileInfo.zeroCount3RN ++;
            }
            else if (peakHour) {
                fileInfo.zeroCount3NP ++;
            }
            else{
                fileInfo.zeroCount3NN ++;
            }
        }
        else if (volume == 1) {
            fileInfo.oneCount3 ++;

            if (rushDay && peakHour) {
                fileInfo.oneCount3RP ++;
            }
            else if (rushDay) {
                fileInfo.oneCount3RN ++;
            }
            else if (peakHour) {
                fileInfo.oneCount3NP ++;
            }
            else{
                fileInfo.oneCount3NN ++;
            }
        }
    }
}

/**
 * Function to detect a change in zone_id, lane_number, and lane_id midway through a file.
 * @param {FileInfo} fileInfo The object holding the current file's info
 * @param {number} lineZoneId The current line's zone_id to be compared against the file's zone_id
 * @param {number} lineLaneNumber The current line's lane_number to be compared against the file's lane_number
 * @param {number} lineLaneId The current line's lane_id to be compared against the file's lane_id
 */
function checkIdError(fileInfo, lineZoneId, lineLaneNumber, lineLaneId) {
    if (fileInfo.zoneId == 0) {
        fileInfo.zoneId = lineZoneId;
    }
    else if (fileInfo.zoneId != lineZoneId) {
        fileInfo.error = "Error: zone_id changed mid-file";
        return false;
    }
    if (fileInfo.laneNumber == 0) {
        fileInfo.laneNumber = lineLaneNumber;
    }
    else if (fileInfo.laneNumber != lineLaneNumber) {
        fileInfo.error = "Error: lane_number changed mid-file";
        return false;
    }
    if (fileInfo.laneId == 0) {
        fileInfo.laneId = lineLaneId;
    }
    else if (fileInfo.laneId != lineLaneId) {
        fileInfo.error = "Error: lane_id changed mid-file";
        return false;
    }

    return true;
}

/**
 * @param {Date} date 
 * @returns boolean for if it is a peak hour on the highway. 
 */
function isPeakHour(date) {
    const hour = date.getHours();
    
    if (hour >= 10 && hour < 21) {
        return true;
    }

    return false;
}

/**
 * @param {Date} date 
 * @returns boolean for if it is a rush day on the highway. 
 */
function isRushDay(date) {
    const weekday = date.getDay();

    if ([5, 6, 0].includes(weekday)) {
        return true;
    }
    return false;
}

/**
 * @param {Date} date 
 * @returns boolean for if the date is within specified time range
 */
function dateInRange(date) {
    if (start_time == null && end_time == null) {
        return true;
    }
    else if (start_time == null) {
        if (date <= end_time) {
            return true;
        }
        return false;
    }
    else if (end_time == null) {
        if (date >= start_time) {
            return true;
        }
        return false;
    }
    else{
        if (date >= start_time && date <= end_time) {
            return true;
        }
        return false;
    }
}

/**
 * Exports results for download.
 * @param {String} filename 
 * @param {String} text 
 */
function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}