function nextPage() {
    document.querySelector('#Next').textContent  = "Next File";
    const content = document.querySelector('.content');
    const fileList = document.getElementById('uploadedfile').files;
    content.innerText = "Analyzing File...\n";

    for (let i = 0; i < fileList.length; i++) {
        const reader = new FileReader();
        const file = fileList[i];

        let fileInfo = new Object();
        // Constants
        fileInfo.numDataPoints = 0;
        fileInfo.zoneId = 0;
        fileInfo.laneNumber = 0;
        fileInfo.laneId = 0;

        // Measurements
        fileInfo.measurementTime = 0;
        fileInfo.speed = 0;
        fileInfo.volume = 0;
        fileInfo.occupancy = 0;
        fileInfo.quality = 0;

        /* Three possible outcomes:
        * 1: Faulty
        * 2: Questionable
        * 3: Non-faulty
        */
        fileInfo.outcome = 0;
        fileInfo.error = undefined;

        reader.onload = (event) => {
            // Reading line by line
            const fileLines = reader.result.split(/\r\n|\n/);
            
            // Need to skip first line header
            fileLines.splice(0, 1);

            fileLines.every(line => {
                if(line != "") {
                    alert(fileInfo.error);
                    processLine(line, fileInfo)
                    if(fileInfo.error != undefined){
                        content.innerText += fileInfo.error + "\n";
                        return false;
                    }

                    return true;
                }
                return false;
            });

            content.innerText += "Number of Sensor Data Points Analyzed: " + fileInfo.numDataPoints;
        };

        if (file) {
            reader.readAsText(file);
        }
    }
}

/**
 * Function to take input of a sensor data point line, and process.
 * @params: line (str), fileInfo (Object)
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
        fileInfo.error = "zone_id changed mid-file";
        return false;
    }
    if(fileInfo.laneNumber == 0) {
        fileInfo.laneNumber = lineLaneNumber;
    }
    else if(fileInfo.laneNumber != lineLaneNumber){
        fileInfo.error = "lane_number changed mid-file";
        return false;
    }
    if(fileInfo.laneId == 0) {
        fileInfo.laneId = lineLaneId;
    }
    else if(fileInfo.laneId != lineLaneId){
        fileInfo.error = "lane_id changed mid-file";
        return false;
    }

    return true;
}

function isRushDay(date) {
    
}

function isPeakHour(hour) {

}