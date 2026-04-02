import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiTags
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionGuard } from '../../common/guards/session.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects with filters and pagination' })
  listProjects(@Query() query: ListProjectsDto) {
    return this.projectsService.listProjects(query);
  }

  @Get('export.csv')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export filtered projects as CSV' })
  async exportProjects(@Query() query: ListProjectsDto, @Res() response: Response) {
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
    await this.projectsService.exportProjects(response, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project' })
  getProject(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create a new project' })
  createProject(
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Body() dto: CreateProjectDto
  ) {
    return this.projectsService.createProject(currentUser, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing project' })
  updateProject(
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto
  ) {
    return this.projectsService.updateProject(currentUser, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project permanently' })
  deleteProject(
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Param('id') id: string
  ) {
    return this.projectsService.deleteProject(currentUser, id);
  }
}
