import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionGuard } from '../../common/guards/session.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
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
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="projects.csv"')
  @ApiOperation({ summary: 'Export filtered projects as CSV' })
  exportProjects(@Query() query: ListProjectsDto, @Res({ passthrough: true }) response: Response) {
    void response;
    return this.projectsService.exportProjects(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project' })
  getProject(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }

  @Post()
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
