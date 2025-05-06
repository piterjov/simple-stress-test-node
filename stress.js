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
const totalRequests = parseInt(args[1], 10);
const concurrency = args.length > 2 ? parseInt(args[2], 10) : 1;

console.log(`Target URL: ${targetUrl.href}`);
console.log(`Total Requests: ${totalRequests}`);
console.log(`Concurrency: ${concurrency}`);

async function fireOnce(id) {
  const start = Date.now();
  console.log(`[START] ${id} @ ${start}`);

  return new Promise((resolve) => {
    const lib = targetUrl.protocol === "https:" ? https : http;

    const req = lib.request(targetUrl, (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        const end = Date.now();
        console.log(`[END]   ${id} @ ${end} (Duration: ${end - start}ms)`);
        resolve({
          status: res.statusCode,
          duration: end - start,
          error: false,
        });
      });
    });

    req.on("error", (err) => {
      const end = Date.now();
      console.log(`[FAIL]  ${id} @ ${end} (${err.message})`);
      resolve({
        status: null,
        duration: end - start,
        error: true,
        message: err.message,
      });
    });

    req.end();
  });
}

async function runLoadTest() {
  let inFlight = 0;
  let completed = 0;
  const results = [];
  let nextId = 1;

  return new Promise((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) {
        return resolve(results);
      }

      if (inFlight >= concurrency || nextId > totalRequests) {
        return;
      }

      if (inFlight >= concurrency) {
        return;
      }

      inFlight++;
      const id = nextId++;
      fireOnce(id).then((result) => {
        inFlight--;
        completed++;
        results.push(result);
        process.stdout.write(`\rCompleted: ${completed}/${totalRequests}`);
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
  console.log(report);
  process.exit(0);
});
