"use client";

import { useRef, useState } from "react";

export function useWorkingDir(initial = "") {
  const [path, setPath] = useState(initial);
  const pickerRef = useRef<HTMLInputElement>(null);

  const openPicker = () => pickerRef.current?.click();

  const onPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Electron 환경에서는 file.path로 전체 경로 획득
      const fullPath = (file as File & { path?: string }).path;
      if (fullPath) {
        // file.path = /full/path/to/dir/some-file → 파일명 제거해서 디렉토리 경로 추출
        setPath(fullPath.slice(0, fullPath.lastIndexOf("/")));
      } else {
        // 일반 브라우저: webkitRelativePath의 최상위 폴더명만 획득
        setPath(file.webkitRelativePath.split("/")[0]);
      }
    }
    e.target.value = "";
  };

  return { path, setPath, pickerRef, openPicker, onPickerChange };
}
