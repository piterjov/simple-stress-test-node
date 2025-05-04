const { error } = require("console");
const http = require("http");
const https = require("https");

const { URL } = require("url");

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    "Usage: node stress.js <url> <number of requests> [concurrency]"
  );
  process.exit(1);
}

const targetUrl = new URL(args[0]);
console.log(targetUrl);

const totalRequests = parseInt(args[1], 10);
const concurrency = parseInt(args[2], 10) || 1;
const lib = targetUrl.protocol === "https:" ? https : http;

async function fireOnce() {
  const start = Date.now();

  return new Promise((resolve) => {
    const req = lib.request(targetUrl, (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        const duration = Date.now() - start;
        resolve({ status: res.statusCode, duration, error: false });
      });
    });

    req.on("error", (err) => {
      const duration = Date.now() - start;
      resolve({ status: null, duration, error: err.message });
    });

    req.end();
  });
}

async function runLoadTest() {
  let inFlight = 0;
  let completed = 0;
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  const startTime = Date.now();

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) {
        return resolve({
          successCount,
          errorCount,
          results,
          duration: Date.now() - startTime,
        });
      }

      if (inFlight >= concurrency) {
        return;
      }
      inFlight++;
      fireOnce().then((result) => {
        inFlight--;
        completed++;
        results.push(result);
        result.error ? errorCount++ : successCount++;
        process.stdout.write(
          `\rCompleted: ${completed}/${totalRequests} | Success: ${successCount} | Errors: ${errorCount} | Duration: ${result.duration}ms`
        );
        launchNext();
      });

      launchNext();
    }

    for (let i = 0; i < concurrency && i < totalRequests; i++) {
      launchNext();
    }
  });
}

runLoadTest().then((report) => {
  console.log("\n--- Report ---");
  console.log("Successes:", report.successCount);
  console.log("Failures:", report.errorCount);
  console.log("Total Duration:", report.duration, "ms");
  console.log(
    "Avg Response Time:",
    Math.round(
      report.results.reduce((sum, r) => sum + r.duration, 0) /
        report.results.length
    ),
    "ms"
  );
});
