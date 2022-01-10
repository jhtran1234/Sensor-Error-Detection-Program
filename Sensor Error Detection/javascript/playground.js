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
    }
}

function execute() {
    const content = document.querySelector('.content');
    const fileList = document.getElementById('uploadedfile').files;

    function readFileList(fileList, content, _callback) {
        var reader = new FileReader();
        var fileText = new Array();
    


        function readFile(index) {
            if(index >= fileList.length) {
                _callback(fileText);
            }
    
            const file = fileList[index];
            alert(file instanceof Blob);
    
            reader.onloadend = function(event) {
                var text = event.target.result;
                var linesArr = new Array();
                
                fileLines = text.split(/\r\n|\n/);
                fileLines.splice(0, 1);
                
                fileLines.every(line => {
                    if(line != "") {
                        let l = new Line(line);
                        linesArr.push(l);
                        return true;
                    }
                    return false;
                });
    
                fileText[index] = linesArr;
                readFile(index + 1);
            }
            if(file){
                reader.readAsBinaryString(file);
            }
        }
    
        readFile(0);
    }


    readFileList(fileList, content, processText);
}



/**
 * Function used as a callback to process text after extraction from files.
 * @param {Array} fileText Array of Line Arrays representing the CSV files
 */ 
function processText(fileText) {
}

/**
 * Function to take input of a sensor data point line, and process.
 * @param {Line} line The Line object to be processed
 * @param {FileInfo} fileInfo The object holding the current file's info
 */ 
 function processLine(line, fileInfo) {
    fileInfo.numDataPoints += 1;

    // Line order: zone_id, lane_number, lane_id, measurement_start, speed, volume, occupancy, quality
    
    // prevent zoneId, laneNumber, laneId from changing mid-file
    if(!checkIdError(fileInfo, line.zoneId, line.laneNumber, line.laneId)) {
        return;
    }

    const rushDay = isRushDay(line.date);
    const peakHour = isPeakHour(line.date);

    const flowRate = line.volume * 60.0;
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
    let v_t2 = line.speed - fileInfo.prevV;

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

    fileInfo.prevTime = line.measurementStart;
    fileInfo.qDiff = flowRate - fileInfo.prevQ;
    fileInfo.vDiff = line.speed - fileInfo.prevV;
    fileInfo.prevQ = flowRate;
    fileInfo.prevV = line.speed;
}