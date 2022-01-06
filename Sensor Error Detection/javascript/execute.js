class FileInfo {
    constructor() {
        // Constants
        this.fileName =  undefined;
        this.numDataPoints = 0;
        this.zoneId = 0;
        this.laneNumber = 0;
        this.laneId = 0;
    
        // Measurements
        this.measurementTime = 0;
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
        this.faultyCount = 0;
        this.error = undefined;
    }
}

function execute() {
    const content = document.querySelector('.content');
    const fileList = document.getElementById('uploadedfile').files;
    content.innerText = "Analyzing File(s)...\n";

    readFileList(fileList, content, processText);
}

function readFileList(fileList, content, _callback) {
    var reader = new FileReader();
    var fileText = new Array();

    function readFile(index) {
        if(index >= fileList.length) {
            _callback(fileText);
        }

        var file = fileList[index];

        reader.onloadend = function(event) {
            fileText[index] = event.target.result;
        }
        reader.readAsText(file);
    }

    readFile(0);
}

/**
 * Function used as a callback to process text after extraction from files.
 * @param {Array} fileText Array of file text from CSV files after text read-in
 */ 
function processText(fileText) {
    var fileInfoArr = new Array();
    var fileInfo = new FileInfo();

    //loop file

    var fileLines = text.split(/\r\n|\n/);
        fileLines.splice(0, 1);

        fileLines.every(line => {
            if(line != "") {
                processLine(line, fileInfo);
                if(fileInfo.error != undefined){
                    content.innerText += fileInfo.error + "\n";
                    return false;
                }

                return true;
            }
            return false;
        });
        content.innerText += fileInfo.laneId + ": " + fileInfo.numDataPoints + " datapoints.\n";
        content.innerText += fileInfo.laneId + ": " + fileInfo.faultyCount + " faulty datapoints.\n";
        fileInfoArr[index] = fileInfo;

        readFile(index + 1);


}

/**
 * Function to take input of a sensor data point line, and process.
 * @param {string} line The CSV line to be processed
 * @param {FileInfo} fileInfo The object holding the current file's info
 */ 
 function processLine(line, fileInfo) {
    fileInfo.numDataPoints += 1;

    const lineSplit = line.split(",");

    // Line order: zone_id, lane_number, lane_id, measurement_start, speed, volume, occupancy, quality
    const zone_id = lineSplit[0];
    const lane_number = lineSplit[1];
    const lane_id = lineSplit[2];
    const date = new Date(lineSplit[3]);
    const speed = lineSplit[4];
    const volume = lineSplit[5];
    const occupancy = lineSplit[6];
    const quality = lineSplit[7];
    
    // prevent zoneId, laneNumber, laneId from changing mid-file
    if(!checkIdError(fileInfo, zone_id, lane_number, lane_id)) {
        return;
    }

    const rushDay = isRushDay(date);
    const peakHour = isPeakHour(date);

    const flowRate = volume * 60.0;
    var fauty = false;
    var reason = "";
    
    if(rushDay && peakHour) { // Rule 1
        if(flowRate > 2290 || flowRate < 345) {
            fauty = true;
            reason = "rule1";
        }
    }
    else if(rushDay && !peakHour) { // Rule 2
        if(flowRate > 1120) {
            fauty = true;
            reason = "rule2";
        }
    }
    else if(!rushDay && peakHour) { // Rule 3
        if(flowRate > 1910) {
            fauty = true;
            reason = "rule3";
        }
    }
    else { // Rule 4
        if(flowRate > 975) {
            fauty = true;
            reason = "rule4";
        }
    }

    if(speed > 110) { // Rule 5
        fauty = true;
        reason = "rule5";
    }

    if(flowRate > 1750 && speed > 75) { // Rule 6
        fauty = true;
        reason = "rule6";
    }

    if(fauty) {
        fileInfo.faultyCount += 1;
        //alert(lineSplit[3] + " " + reason);
    }

    // Rule 7 missing

    /* Note: all errors in rule 8 and 9 are caught retroactively
    * (caught in the next line's processing), which is why values 
    * such as qDiff and prevQ are stored and used in the next process.*/

    // Should process before rules 1-7

    // Polling interval t1
    let q_t1 = fileInfo.qDiff;
    let v_t1 = fileInfo.vDiff;

    // Polling interval t2
    let q_t2 = flowRate - fileInfo.prevQ;
    let v_t2 = speed - fileInfo.prevV;

    var prevFauty = false;
    
    if(peakHour && -(q_t1 * q_t2) > 1400000 && Math.abs(v_t1 * v_t2) < 25) { // Rule 8
        prevFauty = true;
        reason = "rule8";
    }
    
    if(peakHour && -(v_t1 * v_t2) > 140 && Math.abs(q_t1 * q_t2) < 125125) { // Rule 9
        prevFauty = true;
        reason = "rule9";
    }

    
    if(prevFauty) {
        fileInfo.faultyCount += 1;
        //alert(fileInfo.faultyCount);
        //alert(fileInfo.prevTime + " " + reason);
    }

    fileInfo.prevTime = lineSplit[3];
    fileInfo.qDiff = flowRate - fileInfo.prevQ;
    fileInfo.vDiff = speed - fileInfo.prevV;
    fileInfo.prevQ = flowRate;
    fileInfo.prevV = speed;

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
    else if (year == 2023) {
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
    else if (year == 2023) {
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