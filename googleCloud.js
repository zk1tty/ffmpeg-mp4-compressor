const { Storage } = require("@google-cloud/storage");
const path = require("path");
const {
  BUCKET_NAME_GOOGLE_CLOUD,
  PROJECT_ID_GOOGLE_CLOUD 
}= require('./config');

const getBucket = () => {
  const storage = new Storage({
    keyFilename: path.join(__dirname + "/google-cloud-keyfile.json"),
    projectId: PROJECT_ID_GOOGLE_CLOUD,
  });
  const bucket = storage.bucket(BUCKET_NAME_GOOGLE_CLOUD);
  return bucket;
};

async function uploadFile(bucket, destFileName, file) {
  try{
    await bucket.upload(file, {
      destination: destFileName,
    });
    console.log("Uploaded:", destFileName);
    return;
  }catch(e){
    console.log(e);
  }
}

module.exports = { getBucket , uploadFile };