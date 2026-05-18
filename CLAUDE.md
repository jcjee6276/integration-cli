# Project Rules

## Tech Stack
- Frontend: Next.js 16, TypeScript, Tailwind
- Backend: Node.js, SQLite

## Code Style
- Frontend: customhooks + presentation / container pattern으로 분기 , logic은 custom hooks , ui는 atoms 단위로 작성 후 container layer에서 조합 후 named export
- Backend: Module / Layer pattern으로 분기
- 에러 처리는 반드시 try/catch