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
    
        /* Three possible outcomes:
        * 1: Faulty
        * 2: Questionable
        * 3: Non-faulty
        */
        this.outcome = 0;
        this.error = undefined;
    }
}

function execute() {
    const content = document.querySelector('.content');
    const fileList = document.getElementById('uploadedfile').files;
    content.innerText = "Analyzing File(s)...\n";

    const fileInfoArr = readFileList(fileList, content, function (fileInfoArr) {
        // start here
    });
}

function readFileList(fileList, content, _callback) {
    var reader = new FileReader();
    var fileInfoArr = new Array();

    function readFile(index) {
        if(index >= fileList.length) {
            _callback(fileInfoArr);
        }

        var file = fileList[index];

        reader.onloadend = function(event) {
            var fileInfo = new FileInfo();

            var text = event.target.result;
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
            fileInfoArr[index] = fileInfo;

            readFile(index + 1);
        }
        reader.readAsText(file);
    }

    readFile(0);
}

/**
 * Function to take input of a sensor data point line, and process.
 * @param {string} line The CSV line to be processed
 * @param {FileInfo} fileInfo The object holding the current file's info
 */ 
 function processLine(line, fileInfo) {
    fileInfo.numDataPoints += 1;

    const lineSplit = line.split(",");
    
    // prevent zoneId, laneNumber, laneId from changing
    if(!checkIdError(fileInfo, lineSplit[0], lineSplit[1], lineSplit[2])) {
        return;
    }

    // Line order: zone_id, lane_number, lane_id, measurement_start, speed, volume, occupancy, quality
    const date = new Date(lineSplit[3]);
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

function isRushDay(date) {
    const weekday = date.getDay();

    if(weekday == 0 || weekday == 6 || isHoliday(date)) {
        return false;
    }
    return true;
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

function isPeakHour(date) {
    const hour = date.getHours();
    
    if((hour >= 7 && hour < 10) || (hour >= 16 && hour < 19)) {
        return true;
    }

    return false;
}