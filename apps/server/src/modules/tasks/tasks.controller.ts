import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateTaskDto } from './dto/create-task.dto';
import { ExecuteTaskDto } from './dto/execute-task.dto';
import { MergeFileDto } from './dto/merge-file.dto';
import { RerunTaskDto } from './dto/rerun-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({ summary: '작업 생성' })
  @ApiOkResponse({ description: '생성된 작업 정보' })
  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @ApiOperation({ summary: '전체 작업 목록 조회' })
  @ApiOkResponse({ description: '작업 목록 (에이전트 로그 포함)' })
  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @ApiOperation({ summary: '특정 작업 조회' })
  @ApiOkResponse({ description: '작업 상세 정보' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @ApiOperation({ summary: '작업 수정 (제목·디렉토리·요구사항·에이전트)' })
  @ApiOkResponse({ description: '수정된 작업 정보' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @ApiOperation({
    summary: '작업 실행',
    description: '실시간 출력은 WebSocket `/tasks` 네임스페이스의 `agent:output` / `task:status` 이벤트로 수신',
  })
  @ApiOkResponse({ description: '실행 시작 확인' })
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  execute(@Param('id') id: string, @Body() dto: ExecuteTaskDto = {}) {
    return this.tasksService.execute(id, dto.agentTestCodePreferences);
  }

  @ApiOperation({ summary: '실행 중인 작업 중지' })
  @ApiOkResponse({ description: '중지 확인' })
  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  stop(@Param('id') id: string) {
    return this.tasksService.stop(id);
  }

  @ApiOperation({ summary: '작업 재실행', description: '보완 메모를 추가하여 동일 작업을 다시 실행' })
  @ApiOkResponse({ description: '재실행 시작 확인' })
  @Post(':id/rerun')
  @HttpCode(HttpStatus.OK)
  rerun(@Param('id') id: string, @Body() dto: RerunTaskDto) {
    return this.tasksService.rerun(id, dto.supplementNote, dto.writeTestCode);
  }

  @ApiOperation({ summary: '에이전트 단위 작업 재실행', description: '보완 메모를 추가하여 특정 에이전트만 다시 실행' })
  @ApiOkResponse({ description: '에이전트 재실행 시작 확인' })
  @Post(':id/agents/:agentId/rerun')
  @HttpCode(HttpStatus.OK)
  rerunAgent(
    @Param('id') id: string,
    @Param('agentId') agentId: string,
    @Body() dto: RerunTaskDto,
  ) {
    return this.tasksService.rerunAgent(id, Number(agentId), dto.supplementNote, dto.writeTestCode);
  }

  @ApiOperation({ summary: '실행 버전 이력 조회' })
  @ApiOkResponse({ description: '버전별 실행 기록 (supplementNote, 상태, 에이전트 결과 포함)' })
  @Get(':id/runs')
  getRuns(@Param('id') id: string) {
    return this.tasksService.getRuns(id);
  }

  @ApiOperation({ summary: '작업 보관' })
  @ApiNoContentResponse({ description: '보관 완료 (응답 본문 없음)' })
  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id') id: string) {
    return this.tasksService.archive(id);
  }

  @ApiOperation({ summary: '에이전트 전체 변경사항 병합' })
  @ApiOkResponse({ description: '병합 결과' })
  @Post(':id/agents/:agentId/merge')
  mergeAgentAll(
    @Param('id') id: string,
    @Param('agentId') agentId: string,
  ) {
    return this.tasksService.mergeAgentAll(id, Number(agentId));
  }

  @ApiOperation({ summary: '에이전트 단일 파일 병합' })
  @ApiOkResponse({ description: '병합 결과' })
  @Post(':id/agents/:agentId/merge-file')
  mergeAgentFile(
    @Param('id') id: string,
    @Param('agentId') agentId: string,
    @Body() dto: MergeFileDto,
  ) {
    return this.tasksService.mergeAgentFile(id, Number(agentId), dto.filePath);
  }

  @ApiOperation({ summary: '작업 삭제' })
  @ApiNoContentResponse({ description: '삭제 완료 (응답 본문 없음)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
