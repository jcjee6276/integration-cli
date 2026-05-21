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

import { CreateTaskDto } from './dto/create-task.dto';
import { MergeFileDto } from './dto/merge-file.dto';
import { RerunTaskDto } from './dto/rerun-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /** POST /tasks */
  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  /** GET /tasks */
  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  /** GET /tasks/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  /** PATCH /tasks/:id */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  /** POST /tasks/:id/execute */
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  execute(@Param('id') id: string) {
    return this.tasksService.execute(id);
  }

  /** POST /tasks/:id/stop */
  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  stop(@Param('id') id: string) {
    return this.tasksService.stop(id);
  }

  /** POST /tasks/:id/rerun — 보완 사항과 함께 재 실행 */
  @Post(':id/rerun')
  @HttpCode(HttpStatus.OK)
  rerun(@Param('id') id: string, @Body() dto: RerunTaskDto) {
    return this.tasksService.rerun(id, dto.supplementNote);
  }

  /** POST /tasks/:id/archive */
  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id') id: string) {
    return this.tasksService.archive(id);
  }

  /** POST /tasks/:id/agents/:agentId/merge — 전체 병합 */
  @Post(':id/agents/:agentId/merge')
  mergeAgentAll(
    @Param('id') id: string,
    @Param('agentId') agentId: string,
  ) {
    return this.tasksService.mergeAgentAll(id, Number(agentId));
  }

  /** POST /tasks/:id/agents/:agentId/merge-file — 파일 단일 병합 */
  @Post(':id/agents/:agentId/merge-file')
  mergeAgentFile(
    @Param('id') id: string,
    @Param('agentId') agentId: string,
    @Body() dto: MergeFileDto,
  ) {
    return this.tasksService.mergeAgentFile(id, Number(agentId), dto.filePath);
  }

  /** DELETE /tasks/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
