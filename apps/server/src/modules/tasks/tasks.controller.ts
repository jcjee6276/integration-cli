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

  /** DELETE /tasks/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
