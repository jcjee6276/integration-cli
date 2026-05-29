// glob을 mock하여 typeorm의 DirectoryExportedClassesLoader가 path-scurry(ESM)를 로드하지 못하도록 방지
module.exports = {
  glob: jest.fn().mockResolvedValue([]),
  globSync: jest.fn().mockReturnValue([]),
  sync: jest.fn().mockReturnValue([]),
};
