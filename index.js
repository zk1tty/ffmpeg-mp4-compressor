const fs = require('fs');
const { waitFor } = require('wait-for-event');
const tmp = require('tmp');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegStatic);
const { getBucket, uploadFile } = require('./googleCloud');
const {
    gcsPreDirName,
    gcsPostDirName
} = require('./config');

const bucket = getBucket();

async function downloadFile(targetGSFile, preCompFile) {
    const options = {
        destination: preCompFile,
    };
    try{
        await bucket.file(targetGSFile).download(options);
        console.log(
            `Downloaded: ${targetGSFile}`
        );
    }catch(e){
        console.error(e);
    }

}

async function compVideo(videoName) {
    const tmpobj_pre = tmp.fileSync();
    const tmpobj_post = tmp.fileSync();
    const preCompFile = tmpobj_pre.name + ".mp4"
    const postCompFile = tmpobj_post.name + ".mp4"
    const gcsPreFileName = `${gcsPreDirName}/${videoName}`
    const gcsPostFileName = `${gcsPostDirName}/${videoName}` 
    await downloadFile(gcsPreFileName, preCompFile);

    try {
        /**
         * Run FFmpeg
         */
        const emitter = ffmpeg()
        // // FFmpeg expects your frames to be named like frame-001.png, frame-002.png, etc.
        .input(preCompFile)
        // Use the x264 video codec
        .videoCodec('libx264')
        // crf
        .outputOptions('-crf','28')
        .outputOptions('-pix_fmt','yuv420p')
        .outputOptions('-nostdin')
        // Output file
        .saveToFile(postCompFile)

        // Wait until FFmpeg is finished
        await waitFor('end', emitter);
        await uploadFile(bucket, gcsPostFileName, postCompFile);
        tmpobj_pre.removeCallback();
        tmpobj_post.removeCallback();
        return videoName;
    } catch (e) {
    console.error(e);
    if(e.code) console.error(e.code);
    if(e.msg) console.error(e.msg);
    }
}

async function oneTokenIdLoop(id, resolve) {
    const videoNames = Array.from({ length: 6 }, (_, i) => i+1).map((_, i) => `${id}-${i}.mp4`);
    const result = await Promise.all(videoNames.map(async(videoName, idx) => {
        return new Promise(async resolve => {
            let res;
            setTimeout(async() => {
                res = await compVideo(videoName)
                return resolve(res);
            }, 4000 * (idx) * 1.1);
        })}
    ));
    return resolve(result);
}

async function main(_itr, _offset) {
    let itr = Number(_itr);
    let offset = Number(_offset);

    const ids = Array.from({ length: itr }, (_, i) => offset + i);
    console.log("requested Ids:", JSON.stringify(ids));
    /**
     * separate to chunks
    */
   for(let idx =0; idx <ids.length; idx++){
        await new Promise(resolve => oneTokenIdLoop(ids[idx], resolve));
    };
    console.log("finished uploading-ID:", JSON.stringify(ids));
    return ids;
}
/**
 * for local testing:
 * npm run test 1(iteration) 10(offset id)
 */
if(process.argv[1].split('/').slice(-1) == "index.js"){
    if(process.argv.length <= 2) {
        console.error("Warning: Please input itr and offset arguments!");
        process.exit();
    }
    const itr = process.argv.slice(-2)[0]
    const offset = process.argv.slice(-1)[0]
    main(itr, offset);
}

/**
 * Google Cloud Function Name: compvideo
 * GET call sample(local): 
 * http://localhost:8080/?itr=100&offset=1
 */

exports.compvideo = async(req, res) => {
    let itr = req.query.itr;
    let offset = req.query.offset;

    const ids = await main(itr, offset);
    res.status(200).send(`finished uploading: ${JSON.stringify(ids)}\n`);
};