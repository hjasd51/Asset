try {
  process.loadEnvFile();
} catch {
  // .env 파일이 없으면 기본값으로 진행
}

const express = require("express");
const path = require("path");
const realEstateRouter = require("./routes/realEstate");
const loanRouter = require("./routes/loan");
const localDataRouter = require("./routes/localData");
const analyticsRouter = require("./routes/analytics");
const daangnRouter = require("./routes/daangn");
const apartmentsRouter = require("./routes/apartments");

const app = express();

app.use(express.json());

app.use("/api/real-estate", realEstateRouter);
app.use("/api/loan", loanRouter);
app.use("/api/local", localDataRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/daangn", daangnRouter);
app.use("/api/apartments", apartmentsRouter);

// 프로덕션: React 빌드 정적 파일 서빙
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/dist/index.html"));
  });
}

// Vercel 서버리스 환경에서는 listen 대신 app export
if (process.env.NODE_ENV !== "production" || process.env.VERCEL !== "1") {
  const port = process.env.TEST_PORT ? Number(process.env.TEST_PORT) : 3000;
  app.listen(port, () => {
    console.log(`서버 실행 중: http://localhost:${port}`);
  });
}

module.exports = app;
