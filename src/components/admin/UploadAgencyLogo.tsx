import { useState, useCallback, type ChangeEvent, type FC } from "react";
import Cropper, { type Area } from "react-easy-crop";

interface UploadAgencyLogoProps {
  onLogoUploaded: (croppedImage: string) => void;
}

const UploadAgencyLogo: FC<UploadAgencyLogoProps> = ({ onLogoUploaded }) => {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const cropImage = async (): Promise<string> => {
    if (!image || !croppedAreaPixels) return "";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
    });

    const { width, height, x, y } = croppedAreaPixels;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleUploadAndCrop = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const croppedImage = await cropImage();
      if (croppedImage) {
        onLogoUploaded(croppedImage);
        setImage(null);
        setZoom(1);
      }
    } finally {
      setBusy(false);
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
        <div className="cropper-container" style={{ position: "relative", width: "100%", height: 320 }}>
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
            <button type="button" onClick={() => setImage(null)} disabled={busy}>
              ❌ Annuler
            </button>
            <button
              type="button"
              onClick={handleUploadAndCrop}
              className="crop-button"
              disabled={busy}
            >
              {busy ? "⏳ Traitement…" : "✅ Recadrer et Uploader"}
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
};

export default UploadAgencyLogo;
