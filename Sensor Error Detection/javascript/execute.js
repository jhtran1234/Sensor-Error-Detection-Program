class FileInfo {
    constructor() {
        // Constants
        this.fileName =  undefined;
        this.numDataPoints = 0;
        this.zoneId = 0;
        this.laneNumber = 0;
        this.laneId = 0;
    
        // Measurements
        this.fileStartTime = 0;
        this.speed = 0;
        this.volume = 0;
        this.occupancy = 0;
        this.quality = 0;
    
        // ∆s
        this.prevTime = undefined; // stores t so that if there is an error found when processing t+1, the error can be logged at t
        this.prevQ = undefined; // stores Q_t to caulculate the Q∆ at the next item t+1
        this.prevV = undefined; // Stores V_t to caulculate the V∆ at the next item t+1
        this.qDiff = undefined; // updated at every line to reflect Q_(t-1) - Q_(t-2) for polling interval t_1
        this.vDiff = undefined; // updated at every line to reflect V_(t-1) - V_(t-2) for polling interval t_1

        // Outcomes
        this.missingData = 0;
        this.missingSpeed = 0;
        this.missingVol = 0;
        this.faultyCount = 0;
        this.faults = new Array();
        this.error = undefined;
    }
}

class Line {
    constructor(lineSplit) {
        if(typeof(lineSplit) === 'string') {
            lineSplit = lineSplit.split(",");
        }

        this.zoneId = lineSplit[0];
        this.laneNumber = lineSplit[1];
        this.laneId = lineSplit[2];
        this.measurementStart = lineSplit[3];
        this.date = new Date(lineSplit[3]);
        this.speed = lineSplit[4];
        this.volume = lineSplit[5];
        this.occupancy = lineSplit[6];
        this.quality = lineSplit[7];

        this.flowRate = this.volume * 60.0;
    }
}

class Fault {
    constructor(timeStamp, reason) {
        this.timeStamp = timeStamp;
        this.reason = reason;
    }
}

function execute() {
    const content = document.querySelector('.content');
    const fileList = document.getElementById('uploadedfile').files;
    
    if(parseInt(fileList.length) > 2){
        alert("You are only allowed to upload a maximum of 2 files.");
        content.innerText = "You are only allowed to upload a maximum of 2 files.";
    }
    else {
        content.innerText = "Analyzing File(s)...\n";
        readFileList(fileList, content, processText);
    }
}

function readFileList(fileList, content, _callback) {
    var reader = new FileReader();
    var fileText = new Array();
    var fileInfoArr = new Array();

    function readFile(index) {
        if(index >= fileList.length) {
            _callback(fileText, fileInfoArr, content);
        }

        var file = fileList[index];
        fileInfoArr[index] = new FileInfo();
        var prevTime = 0;

        reader.onloadend = function(event) {
            var text = event.target.result;
            var linesArr = new Array();
            
            fileLines = text.split(/\r\n|\n/);
            fileLines.splice(0, 1);

            fileLines.every(line => {
                if(line != "") {
                    let l = new Line(line);
                    linesArr.push(l);

                    let date = new Date(l.measurementStart);
                    
                    // Records number of missing data blocks
                    if(prevTime != 0 && date - prevTime > 60000 && l.measurementStart != "2021-11-07T01:00:00-05:00") {
                        fileInfoArr[index].missingData += ((date - prevTime) / 60000);
                    }
                    else if(prevTime == 0) {
                        fileInfoArr[index].fileStartTime = date;
                    }

                    return true;
                }
                return false;
            });

            fileText[index] = linesArr;

            readFile(index + 1);
        }
        if(file){
            reader.readAsText(file);
        }
    }

    readFile(0);
}

/**
 * Function used as a callback to process text after extraction from files.
 * @param {Array} fileText Array of Line Arrays representing the CSV files
 */ 
function processText(fileText, fileInfoArr, content) {
    var currLine = new Array();
    let numFiles = fileText.length;

    for(let i = 0; i < numFiles; i ++) {
        currLine[i] = 0;
    }

    function finished() {
        let finished = true;
        for(let j = 0; j < numFiles; j ++) {
            finished = finished && (currLine[j]+1 >= fileText[j].length ? true : false);
        }
        return finished;
    }


    // needs a complete rewrite to send back all array indices of elements with a matching date
    
    function earliestDate() {
        let earliestDate = undefined;
        let earliestIndex = 0;
        while(earliestIndex < numFiles && fileText[earliestIndex][currLine[earliestIndex]].date == undefined) {
            earliestIndex ++;
        }

        if(earliestIndex > numFiles) {
            alert("Error! Data time slot error.");
        }

        let earliestDate = fileText[earliestIndex][currLine[earliestIndex]].date;
        let allMatch = true;

        for(let j = earliestIndex; j < numFiles; j ++) {
            if(currLine[j] < fileText[j].length && fileText[j][currLine[j]].date < earliestDate) {
                earliestDate = fileText[j].date;
                earliestIndex = j;
                allMatch = false;
            }
            else if(currLine[j] < fileText[j].length && fileText[j][currLine[j]].date != earliestDate) {
                allMatch = false;
            }
        }

        return allMatch ? -1 : earliestIndex;
    }

    while(!finished()) {
        let earliestIndex = earliestDate();
        
        if(earliestIndex == -1) {
            // Go through all remaining!!! files and run all comparisons
            
            for(let i = 0; i < numFiles; i ++) {
                let line = fileText[i][currLine[i]];

                processLine(line, fileInfoArr[i]);
                currLine[i] += 1;
            }

            // Two lane rules
            if(numFiles == 2) {
                processTwoLineRules(fileText[0][currLine[0]-1], fileInfoArr[0], fileText[1][currLine[1]-1], fileInfoArr[1])
            }
        }
        else{
            // Go through 1 file and run all single-lane comparisons

            let line = fileText[earliestIndex][currLine[earliestIndex]];
            processLine(line, fileInfoArr[earliestIndex]);
            currLine[earliestIndex] += 1;
        }
    }

    content.innerText += "Analysis on " + numFiles + " files finished!\n";
    for(let i = 0; i < numFiles; i ++) {
        content.innerText += "File " + (i+1) + " results:\n";
        content.innerText += "Number of lines: " + fileInfoArr[i].numDataPoints + "\n";
        content.innerText += "Number missing: " + fileInfoArr[i].missingData + "\n";
        content.innerText += "Number faulty: " + fileInfoArr[i].faultyCount + "\n";

        displayFaults(content, fileInfoArr[i].faults, 0);
    }
}

function displayFaults(content, faultArray, index) {
    if(index >= faultArray.length || index >= 10) {
        return;
    }
    
    content.innerText += faultArray[index].timeStamp + " " + faultArray[index].reason + "\n";
    displayFaults(content, faultArray, index+1);
}

/**
 * Function to take input of a sensor data point line, and process.
 * @param {Line} line The Line object to be processed
 * @param {FileInfo} fileInfo The object holding the current file's info
 */ 
 function processLine(line, fileInfo) {
    fileInfo.numDataPoints += 1;
    
    // prevent zoneId, laneNumber, laneId from changing mid-file
    if(!checkIdError(fileInfo, line.zoneId, line.laneNumber, line.laneId)) {
        return;
    }

    const rushDay = isRushDay(line.date);
    const peakHour = isPeakHour(line.date);

    /* Note: all errors in rule 8 and 9 are caught retroactively
    * (caught in the next line's processing), which is why values 
    * such as qDiff and prevQ are stored and used in the next process.*/

    // Polling interval t1
    let q_t1 = fileInfo.qDiff;
    let v_t1 = fileInfo.vDiff;

    // Polling interval t2
    let q_t2 = line.flowRate - fileInfo.prevQ;
    let v_t2 = line.speed - fileInfo.prevV;

    var prevFauty = false;
    var fauty = false;
    var reason = "";
    
    // Rule 8
    if(peakHour && -(q_t1 * q_t2) > 1400000 && Math.abs(v_t1 * v_t2) < 25) {
        prevFauty = true;
        reason = "rule8";
    }
    
    // Rule 9
    if(peakHour && -(v_t1 * v_t2) > 140 && Math.abs(q_t1 * q_t2) < 125125) {
        prevFauty = true;
        reason = "rule9";
    }

    if(prevFauty) {
        fileInfo.faultyCount += 1;
        fileInfo.faults.push(new Fault(fileInfo.prevTime, reason));
    }

    // Rule 1
    if(rushDay && peakHour) { 
        if(line.flowRate > 2290 || line.flowRate < 345) {
            fauty = true;
            reason = "rule1";
        }
    }
    // Rule 2
    else if(rushDay && !peakHour) { 
        if(line.flowRate > 1120) {
            fauty = true;
            reason = "rule2";
        }
    }
    // Rule 3
    else if(!rushDay && peakHour) { 
        if(line.flowRate > 1910) {
            fauty = true;
            reason = "rule3";
        }
    }
    // Rule 4
    else { 
        if(line.flowRate > 975) {
            fauty = true;
            reason = "rule4";
        }
    }

    // Rule 5
    if(line.speed > 110) { 
        fauty = true;
        reason = "rule5";
    }

    // Rule 6
    if(line.flowRate > 1750 && line.speed > 75) {
        fauty = true;
        reason = "rule6";
    }

    // Rule 7
    if(line.speed > 80 && line.flowRate > 1200) {
        fauty = true;
        reason = "rule7";
    }

    if(fauty) {
        fileInfo.faultyCount += 1;
        fileInfo.faults.push(new Fault(line.measurementStart, reason));
    }

    fileInfo.prevTime = line.measurementStart;
    fileInfo.qDiff = line.flowRate - fileInfo.prevQ;
    fileInfo.vDiff = line.speed - fileInfo.prevV;
    fileInfo.prevQ = line.flowRate;
    fileInfo.prevV = line.speed;
}

/**
 * Function to calculate the total highway flow issues across two lanes.
 * @param {Line} line1 The Line object to be processed
 * @param {FileInfo} fileInfo1 The object holding the current file's info
 * @param {Line} line2 The Line object to be processed
 * @param {FileInfo} fileInfo2 The object holding the current file's info
 */ 
function processTwoLineRules(line1, fileInfo1, line2, fileInfo2) {
    
    let totalFlow = line1.flowRate + line2.flowRate;
    let flowDifference = Math.abs(line1.flowRate - line2.flowRate);
    let speedDifference = Math.abs(line1.speed - line2.speed);
    let speedAverage = (line1.speed * line1.volume + line2.speed * line2.volume) / (line1.volume + line2.volume);

    var fauty = false;
    var reason = "";

    // Rule 10
    if(isPeakHour(line1.date) && flowDifference > 1440) {
        prevFauty = true;
        reason = "rule10";
    }

    // Rule 11
    if(isPeakHour(line1.date) && speedDifference > 55) {
        prevFauty = true;
        reason = "rule11";
    }

    // Rule 12
    if(totalFlow <= 2400 && flowDifference > 1960) {
        prevFauty = true;
        reason = "rule12a";
    }
    if(totalFlow > 2400 && totalFlow <= 3600 && flowDifference > 1425) {
        prevFauty = true;
        reason = "rule12b";
    }
    if(totalFlow > 3600 && flowDifference > 1300) {
        prevFauty = true;
        reason = "rule12c";
    }

    // Rule 13
    if(totalFlow <= 1200 && speedDifference > 60) {
        prevFauty = true;
        reason = "rule13a";
    }
    if(totalFlow > 1200 && totalFlow <= 2400 && speedDifference > 40) {
        prevFauty = true;
        reason = "rule13b";
    }
    if(totalFlow > 2400 && totalFlow <= 3600 && speedDifference > 15) {
        prevFauty = true;
        reason = "rule13c";
    }
    if(totalFlow > 3600 && speedDifference > 10) {
        prevFauty = true;
        reason = "rule13d";
    }

    // Rule 14
    if(totalFlow <= 1200 && speedAverage > 100) {
        prevFauty = true;
        reason = "rule14a";
    }
    if(totalFlow > 1200 && totalFlow <= 2400 && speedAverage > 90) {
        prevFauty = true;
        reason = "rule14b";
    }
    if(totalFlow > 2400 && totalFlow <= 3600 && speedAverage > 75) {
        prevFauty = true;
        reason = "rule14c";
    }
    if(totalFlow > 3600 && speedAverage > 70) {
        prevFauty = true;
        reason = "rule14d";
    }

    
    if(fauty) {
        fileInfo1.faultyCount ++;
        fileInfo2.faultyCount ++;
        fileInfo1.faults.push(new Fault(line1.measurementStart, reason));
        fileInfo2.faults.push(new Fault(line2.measurementStart, reason));
    }

}

function checkIdError(fileInfo, lineZoneId, lineLaneNumber, lineLaneId) {
    if(fileInfo.zoneId == 0) {
        fileInfo.zoneId = lineZoneId;
    }
    else if(fileInfo.zoneId != lineZoneId){
        fileInfo.error = "Error: zone_id changed mid-file";
        return false;
    }
    if(fileInfo.laneNumber == 0) {
        fileInfo.laneNumber = lineLaneNumber;
    }
    else if(fileInfo.laneNumber != lineLaneNumber){
        fileInfo.error = "Error: lane_number changed mid-file";
        return false;
    }
    if(fileInfo.laneId == 0) {
        fileInfo.laneId = lineLaneId;
    }
    else if(fileInfo.laneId != lineLaneId){
        fileInfo.error = "Error: lane_id changed mid-file";
        return false;
    }

    return true;
}

function isPeakHour(date) {
    const hour = date.getHours();
    
    if(hour >= 10 && hour < 21) {
        return true;
    }

    return false;
}

function isRushDay(date) {
    const weekday = date.getDay();

    if([5, 6, 0].includes(weekday)) {
        return true;
    }
    return false;
}

function isHoliday(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if(year == 2022){
        if(month == 1 && day == 17){
            return true;
        }
        else if(month == 2 && day == 21){
            return true;
        }
        else if(month == 5 && day == 30){
            return true;
        }
        else if(month == 6 && day == 20){
            return true;
        }
        else if(month == 7 && day == 4){
            return true;
        }
        else if(month == 9 && day == 5){
            return true;
        }
        else if(month == 10 && day == 10){
            return true;
        }
        else if(month == 11 && day == 11){
            return true;
        }
        else if(month == 11 && day == 24){
            return true;
        }
        else if(month == 12 && day == 26){
            return true;
        }
    }
    else if(year == 2023) {
        if(month == 1 && day == 2){
            return true;
        }
        else if(month == 1 && day == 16){
            return true;
        }
        else if(month == 2 && day == 20){
            return true;
        }
        else if(month == 5 && day == 29){
            return true;
        }
        else if(month == 6 && day == 19){
            return true;
        }
        else if(month == 7 && day == 4){
            return true;
        }
        else if(month == 9 && day == 4){
            return true;
        }
        else if(month == 10 && day == 9){
            return true;
        }
        else if(month == 11 && day == 10){
            return true;
        }
        else if(month == 11 && day == 23){
            return true;
        }
        else if(month == 12 && day == 25){
            return true;
        }
    }
    else if(year == 2023) {
        if(month == 1 && day == 1){
            return true;
        }
        else if(month == 1 && day == 15){
            return true;
        }
        else if(month == 2 && day == 19){
            return true;
        }
        else if(month == 5 && day == 27){
            return true;
        }
        else if(month == 6 && day == 19){
            return true;
        }
        else if(month == 7 && day == 4){
            return true;
        }
        else if(month == 9 && day == 2){
            return true;
        }
        else if(month == 10 && day == 14){
            return true;
        }
        else if(month == 11 && day == 11){
            return true;
        }
        else if(month == 11 && day == 28){
            return true;
        }
        else if(month == 12 && day == 25){
            return true;
        }
    }
    else {
        // to be continued
        return false;
    }
}