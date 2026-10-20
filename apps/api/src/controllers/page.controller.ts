import { Request, Response } from 'express';
import { pageService } from '../services/page.service';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const pageController = {
  getPages: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id || null;
    const pages = await pageService.getPages(userId);

    return res.status(200).json(
      new ApiResponse(200, pages, 'Pages retrieved successfully')
    );
  }),

  getPageById: asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      throw new ApiError(400, 'Page ID is required');
    }
    const userId = (req.user as any)?.id || null;
    const page = await pageService.getPageById(id, userId);

    if (!page) {
      throw new ApiError(404, 'Page not found');
    }

    return res.status(200).json(
      new ApiResponse(200, page, 'Page retrieved successfully')
    );
  }),

  createPage: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id || null;
    const { id, parentId, title, icon, coverImage, quote, content } = req.body;

    const page = await pageService.createPage({
      id,
      userId,
      parentId,
      title,
      icon,
      coverImage,
      quote,
      content,
    });

    return res.status(201).json(
      new ApiResponse(201, page, 'Page created successfully')
    );
  }),

  updatePage: asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      throw new ApiError(400, 'Page ID is required');
    }
    const userId = (req.user as any)?.id || null;
    const updates = req.body;

    const page = await pageService.updatePage(id, updates, userId);

    if (!page) {
      throw new ApiError(404, 'Page not found');
    }

    return res.status(200).json(
      new ApiResponse(200, page, 'Page updated successfully')
    );
  }),

  deletePage: asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      throw new ApiError(400, 'Page ID is required');
    }
    const userId = (req.user as any)?.id || null;

    const success = await pageService.deletePage(id, userId);

    if (!success) {
      throw new ApiError(404, 'Page not found or already deleted');
    }

    return res.status(200).json(
      new ApiResponse(200, { id, deleted: true }, 'Page deleted successfully')
    );
  }),
};
