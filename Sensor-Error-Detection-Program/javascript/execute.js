"use strict";

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
				else {
					$("#Next-1").removeAttr("disabled");
				}
			}
			else {
				$("#Next-1").removeAttr("disabled");
			}
		}
		else {
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
        this.numDataPointsPC = 0; // rush, peak hour
        this.numDataPointsPN = 0; // non-rush, peak hour
        this.numDataPointsNC = 0; // rush, non-peak hour
        this.numDataPointsNN = 0; // non-rush, non-peak hour
        this.zoneId = 0;
        this.laneNumber = 0;
        this.laneId = 0;
    
        // Measurements
        this.fileStartTime = 0;
        this.fileLastTime = 0;

        // Outcomes
        this.missingData = 0;
        this.missingSpeed = 0;
        this.missingVol = 0;
        
        this.faultyCount1 = 0;
        this.faultyCount1PC = 0;
        this.faultyCount1PN = 0;
        this.faultyCount1NC = 0;
        this.faultyCount1NN = 0;
  
        this.faultyCount2 = 0;
        this.faultyCount2PC = 0;
        this.faultyCount2PN = 0;
        this.faultyCount2NC = 0;
        this.faultyCount2NN = 0;

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

// Globally scoped
let start_time = null;
let end_time = null;
let results = "";
let info = new FileInfo();

/**
 * Function that is executed upon "Next" HTML button click.
 */
function execute() {
    const fileList = document.getElementById('uploadedfile').files;
    info = new FileInfo();
    start_time = null;
    end_time = null;
    results = "";
    
    info.fileName = fileList[0].name;
    readFile(fileList[0], document);
}


function readFile(file, document) {
    let reader = new FileReader();

    reader.readAsText(file);

    reader.onload = function() {
        let text = reader.result;
        let linesArr = new Array();
        
        let fileLines = text.split(/\r\n|\n/);
        fileLines.splice(0, 1);

        fileLines.every(line => {
            if (line != "") {
                let l = new Line(line);
                linesArr.push(l);
                
                if (info.fileStartTime == 0 || info.fileStartTime === undefined) {
                    info.fileStartTime = l.date;
                }
                return true;
            }
            return false;
        });
        
        processText(linesArr, document);
    };

    reader.onerror = function() {
        console.log(reader.error);
    };

}

/**
 * Function used as a callback to process text after extraction from files.
 * @param {Array} fileText Line Array representing the CSV file lines
 * @param {Document} document HTML Document to write results to
 */ 
function processText(fileText, document) {
    // Line-by-line processing of the files starts here
    for (let i = 0; i < fileText.length; i++) {
       processLine(fileText[i], info);
    }
    
    const missingRate = info.faultyCount1 / info.numDataPoints;
    const faultyRate = (info.faultyCount1 + info.faultyCount2) / (info.numDataPoints);

    writeToHTML(document, info, missingRate, faultyRate);

	for (let i = 0; i < info.faults.length; i++) {
        results += info.faults[i].toString() + "\n";
	}
}

/**
 * @param {Line} line the line being analyzed
 */
function processLine(line) {
    let date = new Date(line.date);

    // Quits line processing if it is not in the date range
    if (!dateInRange(date)) {
        return;
    }
    
    let prevTime = 0;
    prevTime = info.fileLastTime;
    info.fileLastTime = date;

    // Finds and records number of missing data blocks
    // Does not count Daylight Savings Data Override as an error
    if (prevTime != 0 && date - prevTime > 60000 && line.measurementStart != "2021-11-07T01:00:00-05:00") {
        //fileInfo.missingData += ((date - prevTime) / 60000) - 1;

        let i = new Date(prevTime);
        i = new Date(i.setMinutes(i.getMinutes() + 1));

        for (i; i < date; i = new Date(i.setMinutes(i.getMinutes() + 1))) {
            const rushDay = isRushDay(i);
            const peakHour = isPeakHour(i);
            info.faults.push(new Fault(i.toString(), "Stage 1, Missing Interval"));
            
            info.numDataPoints++;
            info.faultyCount1++;
            if (rushDay && peakHour) {
                info.numDataPointsPC++;
                info.faultyCount1PC++;
            }
            else if (rushDay) {
                info.numDataPointsNC++;
                info.faultyCount1NC++;
            }
            else if (peakHour) {
                info.numDataPointsPN++;
                info.faultyCount1PN++;
            }
            else {
                info.numDataPointsNN++;
                info.faultyCount1NN++;
            }
        }
    }

    const rushDay = isRushDay(date);
    const peakHour = isPeakHour(date);

    info.numDataPoints++;
    if (rushDay && peakHour) {
        info.numDataPointsPC++;
    }
    else if (rushDay) {
        info.numDataPointsNC++;
    }
    else if (peakHour) {
        info.numDataPointsPN++;
    }
    else {
        info.numDataPointsNN++;
    }
    
    // prevent zoneId, laneNumber, laneId from changing mid-file
    if (!checkIdError(info, line.zoneId, line.laneNumber, line.laneId)) {
        return;
    }

    let faulty = false;
    let reason = "";

    // check to ensure all sppeed and volume data is present
    if (line.volume === undefined) {
        info.missingVol++;
        faulty = true;
        reason = "Stage 1, Missing Volume Data";
    }
    else if (line.speed === undefined && line.volume != 0) {
        info.missingSpeed++;
        faulty = true;
        reason = "Stage 1, Missing Speed Data";
    }

    if (faulty) {
        info.faults.push(new Fault(new Date(line.measurementStart), reason));
        info.faultyCount1++;
        if (rushDay && peakHour) {
            info.faultyCount1PC++;
        }
        else if (rushDay) {
            info.faultyCount1NC++;
        }
        else if (peakHour) {
            info.faultyCount1PN++;
        }
        else {
            info.faultyCount1NN++;
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
        info.faultyCount2++;
        info.faults.push(new Fault(new Date(line.measurementStart), reason));

        if (rushDay && peakHour) {
            info.faultyCount2PC++;
        }
        else if (rushDay) {
            info.faultyCount2NC++;
        }
        else if (peakHour) {
            info.faultyCount2PN++;
        }
        else {
            info.faultyCount2NN++;
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
        info.faultyCount2++;
        info.faults.push(new Fault(new Date(line.measurementStart), "Stage 3, data does not fit any zone"));

        if (rushDay && peakHour) {
            info.faultyCount2PC++;
        }
        else if (rushDay) {
            info.faultyCount2NC++;
        }
        else if (peakHour) {
            info.faultyCount2PN++;
        }
        else {
            info.faultyCount2NN++;
        }
    }
}

/**
 * Writes results to HTML display screen.
 * @param {Document} document 
 * @param {FileInfo} info 
 * @param {Number} missingRate 
 * @param {Number} faultyRate 
 */
function writeToHTML(document, info, missingRate, faultyRate) {
    document.getElementById('info_list_ele_sensor').innerHTML = "<b>Sensor:</b> " + info.fileName;
    document.getElementById('info_list_ele_zone').innerHTML = "<b>Zone ID:</b> " + info.zoneId;
    document.getElementById('info_list_ele_lane').innerHTML = "<b>Lane:</b> " + info.laneNumber;
    document.getElementById('info_list_ele_start').innerHTML = "<b>Start time:</b> " + info.fileStartTime;
    document.getElementById('info_list_ele_end').innerHTML = "<b>End time:</b> " + info.fileLastTime;
    document.getElementById('info_list_ele_intervals').innerHTML = "<b>Total number of time intervals in the entire period:</b> " + info.numDataPoints;

    document.querySelector('#tpc').innerText = info.numDataPointsPC == 0 ? "NA" : Math.round(info.numDataPointsPC / 60) + ' hours';
    document.querySelector('#tnc').innerText = info.numDataPointsNC == 0 ? "NA" : Math.round(info.numDataPointsNC / 60) + ' hours';
    document.querySelector('#tpn').innerText = info.numDataPointsPN == 0 ? "NA" : Math.round(info.numDataPointsPN / 60) + ' hours';
    document.querySelector('#tnn').innerText = info.numDataPointsNN == 0 ? "NA" : Math.round(info.numDataPointsNN / 60) + ' hours';
    document.querySelector('#tpx').innerText = Math.round((info.numDataPointsPC + info.numDataPointsPN) / 60) + ' hours';
    document.querySelector('#tnx').innerText = Math.round((info.numDataPointsNC + info.numDataPointsNN) / 60) + ' hours';

    document.querySelector('#txc').innerText = Math.round((info.numDataPointsPC + info.numDataPointsNC) / 60) + ' hours';
    document.querySelector('#txn').innerText = Math.round((info.numDataPointsPN + info.numDataPointsNN) / 60) + ' hours';
    document.querySelector('#t').innerText = Math.round((info.numDataPoints) / 60) + ' hours';

    // Display percentage of missing 
    document.querySelector('#total_faulty').innerText = info.numDataPoints == 0 ? "Total Missing/Faulty Rate: NA" : "Total Missing/Faulty Rate: "
        + Math.round(faultyRate * 10000) / 100
        + "% (" + (info.faultyCount1 + info.faultyCount2) + " / " + info.numDataPoints + " time intervals)";
    document.querySelector('#mpc').innerText = info.numDataPointsPC == 0 ? "NA" : Math.round((info.faultyCount1PC + info.faultyCount2PC) / info.numDataPointsPC * 10000) / 100 + '%';
    document.querySelector('#mnc').innerText = info.numDataPointsNC == 0 ? "NA" : Math.round((info.faultyCount1NC + info.faultyCount2NC) / info.numDataPointsNC * 10000) / 100 + '%';
    document.querySelector('#mpn').innerText = info.numDataPointsPN == 0 ? "NA" : Math.round((info.faultyCount1PN + info.faultyCount2PN) / info.numDataPointsPN * 10000) / 100 + '%';
    document.querySelector('#mnn').innerText = info.numDataPointsNN == 0 ? "NA" : Math.round((info.faultyCount1NN + info.faultyCount2NN) / info.numDataPointsNN * 10000) / 100 + '%';
    
    document.querySelector('#mxc').innerText = info.numDataPointsPC + info.numDataPointsNC == 0 ? "NA" : Math.round((info.faultyCount1PC + info.faultyCount2PC + info.faultyCount1NC + info.faultyCount2NC) / (info.numDataPointsPC + info.numDataPointsNC) * 10000) / 100 + '%';
    document.querySelector('#mxn').innerText = info.numDataPointsPN + info.numDataPointsNN == 0 ? "NA" : Math.round((info.faultyCount1PN + info.faultyCount2PN + info.faultyCount1NN + info.faultyCount2NN) / (info.numDataPointsPN + info.numDataPointsNN) * 10000) / 100 + '%';
    document.querySelector('#mpx').innerText = info.numDataPointsPN + info.numDataPointsPC == 0 ? "NA" : Math.round((info.faultyCount1PN + info.faultyCount2PN + info.faultyCount1PC + info.faultyCount2PC) / (info.numDataPointsPN + info.numDataPointsPC) * 10000) / 100 + '%';
    document.querySelector('#mnx').innerText = info.numDataPointsNN + info.numDataPointsNC == 0 ? "NA" : Math.round((info.faultyCount1NN + info.faultyCount2NN + info.faultyCount1NC + info.faultyCount2NC) / (info.numDataPointsNN + info.numDataPointsNC) * 10000) / 100 + '%';
    
    document.querySelector('#m').innerText = info.numDataPoints == 0 ? "NA" : Math.round(faultyRate * 10000) / 100 + '%';

    if (info.numDataPoints == 0) {
        alert("The selected date range is not within the range of data, please go back and select another date range.");
    }
    else if (missingRate >= 0.25 || faultyRate >= 0.3) {
        document.querySelector('#replace_box').checked = true;
        document.querySelector('#calibrate_box').checked = false;
        document.querySelector('#good_box').checked = false;
        document.querySelector('#replace_label').style.fontWeight = "bold";
    }
    else if (missingRate >= 0.05 || faultyRate >= 0.05) {
        document.querySelector('#replace_box').checked = false;
        document.querySelector('#calibrate_box').checked = true;
        document.querySelector('#good_box').checked = false;
        document.querySelector('#calibrate_label').style.fontWeight = "bold";
    }
    else {
        document.querySelector('#replace_box').checked = false;
        document.querySelector('#calibrate_box').checked = false;
        document.querySelector('#good_box').checked = true;
        document.querySelector('#good_label').style.fontWeight = "bold";
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
    else {
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
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}