import torch
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU Name: {torch.cuda.get_device_name(0)}")
    print(f"CUDA Version (PyTorch): {torch.version.cuda}")
    print(f"CUDNN Version: {torch.backends.cudnn.version()}")
else:
    print("CUDA is NOT available to PyTorch.")
