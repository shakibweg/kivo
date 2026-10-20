import { Request, Response } from 'express';
import { imageService } from '../services/image.service';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

const userIdOf = (req: Request): string | null => (req.user as any)?.id || null;
const paramId = (req: Request): string => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!id) throw new ApiError(400, 'Image ID is required');
  return id;
};

export const imageController = {
  /** POST /api/images/upload-url — returns a pre-signed PUT URL. */
  createUploadUrl: asyncHandler(async (req: Request, res: Response) => {
    const { fileName, contentType, size } = req.body ?? {};
    const target = await imageService.createUploadTarget(userIdOf(req), {
      fileName,
      contentType,
      size,
    });
    return res.status(200).json(new ApiResponse(200, target, 'Pre-signed upload URL created'));
  }),

  /** POST /api/images — called after the client uploaded to the pre-signed URL. */
  confirmUpload: asyncHandler(async (req: Request, res: Response) => {
    const { key, fileName, contentType } = req.body ?? {};
    const image = await imageService.confirmUpload(userIdOf(req), { key, fileName, contentType });
    return res.status(201).json(
      new ApiResponse(
        201,
        { ...image, path: `/api/images/${image.id}/file` },
        'Image saved successfully'
      )
    );
  }),

  /** GET /api/images/:id — metadata. */
  getImage: asyncHandler(async (req: Request, res: Response) => {
    const image = await imageService.getImage(paramId(req));
    if (!image) throw new ApiError(404, 'Image not found');
    return res.status(200).json(new ApiResponse(200, image, 'Image retrieved successfully'));
  }),

  /**
   * GET /api/images/:id/file — stable, embeddable URL. Redirects to a freshly
   * signed storage URL so stored page content never contains expiring links.
   */
  serveImage: asyncHandler(async (req: Request, res: Response) => {
    const image = await imageService.getImage(paramId(req));
    if (!image) throw new ApiError(404, 'Image not found');
    const url = await imageService.getViewUrl(image);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.redirect(302, url);
  }),
};
