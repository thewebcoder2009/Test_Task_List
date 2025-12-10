// Random animated square elements
function createRandomSquare() {
    const square = document.createElement('div');
    
    // Random size between 20px and 100px
    const size = Math.random() * 80 + 20;
    
    // Random position on viewport
    const posX = Math.random() * (window.innerWidth - size);
    const posY = Math.random() * (window.innerHeight - size);
    
    // Random color with transparency
    const colors = ['#4c8dff', '#33c27d', '#f0ad4e', '#d9534f', '#5bc0de', '#5cb85c'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    square.style.position = 'fixed';
    square.style.left = posX + 'px';
    square.style.top = posY + 'px';
    square.style.width = size + 'px';
    square.style.height = size + 'px';
    square.style.backgroundColor = randomColor;
    square.style.opacity = '0.6';
    square.style.borderRadius = '4px';
    square.style.pointerEvents = 'none';
    square.style.zIndex = '-1';
    square.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.3)`;
    
    // Add animation
    const animationDuration = Math.random() * 3 + 2; // 2-5 seconds
    square.style.animation = `float ${animationDuration}s ease-in-out infinite`;
    
    document.body.appendChild(square);
    
    return square;
}

// Generate multiple random squares
function createAnimationBackground(count = 5) {
    // Add CSS animation keyframes if not already present
    if (!document.getElementById('animation-styles')) {
        const style = document.createElement('style');
        style.id = 'animation-styles';
        style.textContent = `
            @keyframes float {
                0%, 100% {
                    transform: translateY(0px) rotate(0deg);
                }
                50% {
                    transform: translateY(-20px) rotate(5deg);
                }
            }
            
            @keyframes fade-in-out {
                0%, 100% {
                    opacity: 0.3;
                }
                50% {
                    opacity: 0.8;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Create multiple squares - all at once, no stagger
    for (let i = 0; i < count; i++) {
        createRandomSquare();
    }
}

// Auto-trigger on page load
document.addEventListener('DOMContentLoaded', () => createAnimationBackground(10));

// Expose functions globally so they can be called from HTML or console
window.createRandomSquare = createRandomSquare;
window.createAnimationBackground = createAnimationBackground;