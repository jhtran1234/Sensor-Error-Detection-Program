/**
 * Class to represent the entire CSV file.
 */
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

        // Outcomes
        this.missingData = 0;
        this.missingSpeed = 0;
        this.missingVol = 0;
        this.faultyCount = 0;
        this.faults = new Array();
        this.error = undefined;
    }
}

/**
 * Class to represent a CSV line, which is also an individual lane sensor data point.
 */
class Line {
    constructor(lineSplit) {
        if(typeof(lineSplit) === 'string') {
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
}

/**
 * Function that is executed upon "Analyze" HTML button click.
 */
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

/**
 * Function to begin reading the list of files and converting them to Arrays of Line objects for processing.
 * @param {Array} fileList Array of files from the HTML uploadedfile element 
 * @param {Element} content HTML Element to write results to
 * @param {Function} _callback processText function is passed here to continue after async file read
 */
function readFileList(fileList, content, _callback) {
    var reader = new FileReader();
    var fileText = new Array();
    var fileInfoArr = new Array();

    /**
     * Recursive function to read in files in the file list one-by-one, before being processed async by the callback function.
     * @param {Number} index Index of the file on the file array being read
     */
    function readFile(index) {
        if(index >= fileList.length) {
            _callback(fileText, fileInfoArr, content);
        }

        var file = fileList[index];

        if(file){
            fileInfoArr[index] = new FileInfo();
            fileInfoArr[index].fileName = file.name;
        }

        // Used to keep track of the previous measurement on the data file to ensure no gaps are in the file
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
                    
                    // Finds and records number of missing data blocks
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
 * @param {Array} fileInfoArr Array of FileInfo objects storing document data
 * @param {Element} content HTML Element to write results to
 */ 
function processText(fileText, fileInfoArr, content) {
    var currLine = new Array();
    let numFiles = fileText.length;

    for(let i = 0; i < numFiles; i ++) {
        currLine[i] = 0;
    }

    /* 
    * Function to determine if all file lines have been processed and the line-by-line processing can terminate.
    */
    function finished() {
        let finished = true;
        for(let j = 0; j < numFiles; j ++) {
            finished = finished && (currLine[j]+1 >= fileText[j].length ? true : false);
        }
        return finished;
    }


    /**
    * Function to return an Array of the indices of the files with the earliest measurement times for immediate processing.
    */     
    function earliestDate() {
        let earliestDate = undefined;
        let earliestIndex = 0;

        // Array to store all file indices with the earliest measurement time
        let indicesArray = new Array();

        while(earliestIndex < numFiles && fileText[earliestIndex][currLine[earliestIndex]] == undefined) {
            earliestIndex ++;
        }

        if(earliestIndex > numFiles) {
            alert("Error! Data was not found.");
        }

        indicesArray = [earliestIndex];
        earliestDate = fileText[earliestIndex][currLine[earliestIndex]].date;

        // Finding the earliest measurement time out of the remaining files, j represents file index
        for(let j = earliestIndex + 1; j < numFiles; j ++) {
            if(currLine[j] < fileText[j].length && fileText[j][currLine[j]].date < earliestDate) {
                earliestDate = fileText[j].date;
                indicesArray = [j];
            }
            else if(currLine[j] < fileText[j].length && fileText[j][currLine[j]].date == earliestDate) {
                indicesArray.push(j);
            }
        }

        return indicesArray;
    }

    while(!finished()) {
        let indicesArray = earliestDate();

        for(let i = 0; i < indicesArray.length; i ++) {
            let fileIndex = indicesArray[i];

            processLine(fileText[fileIndex], currLine[fileIndex], fileInfoArr[fileIndex]);
            currLine[fileIndex] += 1;
        }

        // Two lane rules
        if(indicesArray.length == 2) {
            let fileIndex1 = indicesArray[0];
            let fileIndex2 = indicesArray[1];
            processTwoLineRules(fileText[fileIndex1][currLine[fileIndex1]-1], fileInfoArr[fileIndex1], fileText[fileIndex2][currLine[fileIndex2]-1], fileInfoArr[fileIndex2]);
        }
    }

    content.innerText += "Analysis on " + numFiles + " files finished!\n";
    for(let i = 0; i < numFiles; i ++) {
        content.innerText += "File " + fileInfoArr[i].fileName + " results:\n";
        content.innerText += "Number of lines: " + fileInfoArr[i].numDataPoints + "\n";
        content.innerText += "Number of timed measurements missing: " + fileInfoArr[i].missingData + "\n";
        content.innerText += "Number of speed datapoints missing: " + fileInfoArr[i].missingSpeed + "\n";
        content.innerText += "Number of volume datapoints missing: " + fileInfoArr[i].missingVol + "\n";
        content.innerText += "Number faulty: " + fileInfoArr[i].faultyCount + "\n";

        displayFaults(content, fileInfoArr[i].faults, 0);
    }
}

/**
 * Recursive runction to display file faults to the HTML Element.
 * @param {Element} content HTML Element to write results to
 * @param {Array} faultArray Array of file faults to write to the HTML page
 * @param {number} index Index of the faultArray currently being written to HTML Element
 */
function displayFaults(content, faultArray, index) {
    if(index >= faultArray.length || index >= 200) {
        return;
    }
    
    content.innerText += faultArray[index].timeStamp + " " + faultArray[index].reason + "\n";
    displayFaults(content, faultArray, index+1);
}


 function processLine(lineArray, lineIndex, fileInfo) {
    let line = lineArray[lineIndex];

    fileInfo.numDataPoints ++;
    
    // prevent zoneId, laneNumber, laneId from changing mid-file
    if(!checkIdError(fileInfo, line.zoneId, line.laneNumber, line.laneId)) {
        return;
    }

    const rushDay = isRushDay(line.date);
    const peakHour = isPeakHour(line.date);

    var faulty = false;
    var reason = "";

    // check to ensure all sppeed and volume data is present
    if(line.volume === undefined) {
        fileInfo.missingVol ++;
        fileInfo.faults.push(new Fault(line.measurementStart, "Missing Volume Data"));
    }
    else if(line.speed === undefined && line.volume != 0) {
        fileInfo.missingSpeed ++;
        fileInfo.faults.push(new Fault(line.measurementStart, "Missing Speed Data"));
    }

    // Rule 1
    if(rushDay && peakHour) { 
        if(line.flowRate > 2290 || line.flowRate < 345) {
            faulty = true;
            reason = "rule1";
        }
    }
    // Rule 2
    else if(rushDay && !peakHour) { 
        if(line.flowRate > 1120) {
            faulty = true;
            reason = "rule2";
        }
    }
    // Rule 3
    else if(!rushDay && peakHour) { 
        if(line.flowRate > 1910) {
            faulty = true;
            reason = "rule3";
        }
    }
    // Rule 4
    else { 
        if(line.flowRate > 975) {
            faulty = true;
            reason = "rule4";
        }
    }

    if(faulty) {
        fileInfo.faultyCount += 1;
        fileInfo.faults.push(new Fault(line.measurementStart, reason));
        faulty = false;
    }

    // Rule 5
    if(line.speed > 110) { 
        faulty = true;
        reason = "rule5";
    }

    // Rule 6
    if(line.flowRate > 1750 && line.speed > 75) {
        faulty = true;
        reason = "rule6";
    }

    // Rule 7
    if(line.speed > 80 && line.flowRate > 1200) {
        faulty = true;
        reason = "rule7";
    }

    if(faulty) {
        fileInfo.faultyCount += 1;
        fileInfo.faults.push(new Fault(line.measurementStart, reason));
        faulty = false;
    }

    // processing rule 8 and 9 require that all speed data is present
    if(line.speed != undefined && lineIndex-1 >= 0 && lineArray[lineIndex-1].speed != undefined && lineIndex+1 < lineArray.length && lineArray[lineIndex-1].speed != undefined) {
        // polling interval t1
        let q_t1 = line.flowRate - lineArray[lineIndex-1].flowRate;
        let v_t1 = line.speed - lineArray[lineIndex-1].speed;

        // polling interval t2
        let q_t2 = lineArray[lineIndex+1].flowRate - line.flowRate;
        let v_t2 = lineArray[lineIndex+1].speed - line.speed;

        // Rule 8
        if(peakHour && (-1 * (q_t1 * q_t2)) > 1400000 && Math.abs(v_t1 * v_t2) < 25) {
            faulty = true;
            reason = "rule8";
        }
        
        // Rule 9
        if(peakHour && (-1 * (v_t1 * v_t2)) > 140 && Math.abs(q_t1 * q_t2) < 125125) {
            faulty = true;
            reason = "rule9 " + v_t1 + " &&& " + v_t2;
        }

        if(faulty) {
            fileInfo.faultyCount ++;
            fileInfo.faults.push(new Fault(line.measurementStart, reason));
        }
    }
}

/**
 * Function to calculate the total highway flow issues across two lanes.
 * @param {Line} line1 The Line object to be processed
 * @param {FileInfo} fileInfo1 The object holding the current file's info
 * @param {Line} line2 The Line object to be processed
 * @param {FileInfo} fileInfo2 The object holding the current file's info
 */ 
function processTwoLineRules(line1, fileInfo1, line2, fileInfo2) {
    
    // data is missing from one of the lines and two line rules cannot be processed
    if(line1.volume === undefined || line2.volume === undefined || (line1.speed === undefined && line1.volume != 0) || (line2.speed === undefined && line2.volume != 0)) {
        return;
    }

    let totalFlow = line1.flowRate + line2.flowRate;
    let flowDifference = Math.abs(line1.flowRate - line2.flowRate);
    let speedDifference = Math.abs(line1.speed - line2.speed);
    let speedAverage = (line1.speed * line1.volume + line2.speed * line2.volume) / (line1.volume + line2.volume);

    var faulty = false;
    var reason = "";

    // Rule 10
    if(isPeakHour(line1.date) && flowDifference > 1440) {
        faulty = true;
        reason = "rule10";
    }

    // Rule 11
    if(isPeakHour(line1.date) && speedDifference > 55) {
        faulty = true;
        reason = "rule11";
    }

    // Rule 12
    if(totalFlow <= 2400 && flowDifference > 1960) {
        faulty = true;
        reason = "rule12a";
    }
    if(totalFlow > 2400 && totalFlow <= 3600 && flowDifference > 1425) {
        faulty = true;
        reason = "rule12b";
    }
    if(totalFlow > 3600 && flowDifference > 1300) {
        faulty = true;
        reason = "rule12c";
    }

    // Rule 13
    if(totalFlow <= 1200 && speedDifference > 60) {
        faulty = true;
        reason = "rule13a";
    }
    if(totalFlow > 1200 && totalFlow <= 2400 && speedDifference > 40) {
        faulty = true;
        reason = "rule13b";
    }
    if(totalFlow > 2400 && totalFlow <= 3600 && speedDifference > 15) {
        faulty = true;
        reason = "rule13c";
    }
    if(totalFlow > 3600 && speedDifference > 10) {
        faulty = true;
        reason = "rule13d";
    }

    // Rule 14
    if(totalFlow <= 1200 && speedAverage > 100) {
        faulty = true;
        reason = "rule14a";
    }
    if(totalFlow > 1200 && totalFlow <= 2400 && speedAverage > 90) {
        faulty = true;
        reason = "rule14b";
    }
    if(totalFlow > 2400 && totalFlow <= 3600 && speedAverage > 75) {
        faulty = true;
        reason = "rule14c";
    }
    if(totalFlow > 3600 && speedAverage > 70) {
        faulty = true;
        reason = "rule14d";
    }

    
    if(faulty) {
        fileInfo1.faultyCount ++;
        fileInfo2.faultyCount ++;
        fileInfo1.faults.push(new Fault(line1.measurementStart, reason));
        fileInfo2.faults.push(new Fault(line2.measurementStart, reason));
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

/**
 * @param {Date} date 
 * @returns boolean for if it is a peak hour on the highway. 
 */
function isPeakHour(date) {
    const hour = date.getHours();
    
    if(hour >= 10 && hour < 21) {
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

    if([5, 6, 0].includes(weekday)) {
        return true;
    }
    return false;
}

/**
 * @param {Date} date 
 * @returns boolean for if it is a holiday on the highway. 
 */
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