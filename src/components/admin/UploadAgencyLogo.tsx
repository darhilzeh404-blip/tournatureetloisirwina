import { useState, type ChangeEvent, type FC } from "react";
import Cropper from "react-easy-crop";

interface UploadAgencyLogoProps {
  onLogoUploaded: (croppedImage: string) => void;
}

const UploadAgencyLogo: FC<UploadAgencyLogoProps> = ({ onLogoUploaded }) => {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (_crop: any, croppedAreaPixelsValue: any) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  };

  const cropImage = async (): Promise<string> => {
    if (!image || !croppedAreaPixels) return "";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const img = new Image();
    img.src = image;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    const cropWidth = croppedAreaPixels.width;
    const cropHeight = croppedAreaPixels.height;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(
      img,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleUploadAndCrop = async () => {
    if (!image) return;
    const croppedImage = await cropImage();
    if (croppedImage) {
      onLogoUploaded(croppedImage);
      setImage(null);
      setZoom(1);
    }
  };

  return (
    <div className="logo-upload-container">
      {!image ? (
        <div className="upload-placeholder">
          <input
            type="file"
            accept="image/*"
            onChange={onImageChange}
            id="logo-upload"
            style={{ display: "none" }}
          />
          <label htmlFor="logo-upload" className="upload-button">
            📷 Uploader le logo
          </label>
          <p>Format: JPG, PNG (min 200x200px)</p>
        </div>
      ) : (
        <div className="cropper-container">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="cover"
          />
          <div className="cropper-controls">
            <button type="button" onClick={() => setImage(null)}>
              ❌ Annuler
            </button>
            <button type="button" onClick={handleUploadAndCrop} className="crop-button">
              ✅ Recadrer et Uploader
            </button>
          </div>
          <div className="zoom-control">
            <label>Zoom:</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
