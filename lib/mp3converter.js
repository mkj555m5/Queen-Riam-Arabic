const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const os = require("os");

function toMp3(buffer, format = "mp4") {
  return new Promise((resolve, reject) => {
    const inputFile = path.join(os.tmpdir(), `input_${Date.now()}.${format}`);
    const outputFile = path.join(os.tmpdir(), `output_${Date.now()}.mp3`);

    fs.writeFileSync(inputFile, buffer);

    ffmpeg()
      .input(inputFile)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .outputOptions("-vn")
      .save(outputFile)
      .on("end", () => {
        const data = fs.readFileSync(outputFile);
        fs.unlinkSync(inputFile);
        fs.unlinkSync(outputFile);
        resolve({
          data,
          delete: () => {
            try {
              fs.unlinkSync(inputFile);
              fs.unlinkSync(outputFile);
            } catch {}
          }
        });
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        fs.unlinkSync(inputFile);
        reject(err);
      });
  });
}

module.exports = { toMp3 };