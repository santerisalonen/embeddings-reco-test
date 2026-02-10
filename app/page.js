'use client';

import { useState, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Card, 
  Image, 
  Text, 
  Button, 
  ActionIcon, 
  Group, 
  Title, 
  Badge, 
  Stack,
  Box,
  SimpleGrid,
  Loader,
  Center,
  Switch,
  AppShell,
  ScrollArea,
  Divider,
  SegmentedControl
} from '@mantine/core';
import { IconHeart, IconRefresh } from '@tabler/icons-react';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendationOnly, setRecommendationOnly] = useState(false);
  const [category, setCategory] = useState('apparel');

  useEffect(() => {
    fetchProducts();
    fetchRecommendations();
  }, [recommendationOnly, category]);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await fetch(`/api/products?category=${category}`);
    const data = await res.json();
    setProducts(data);
    setLoading(false);
  };

  const fetchRecommendations = async () => {
    const res = await fetch(`/api/recommendations?recommendationOnly=${recommendationOnly}&category=${category}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setRecommendations(data);
    }
  };

  const handleLike = async (productId) => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, action: 'like' }),
    });
    fetchRecommendations();
  };

  const handleReset = async () => {
    await fetch('/api/events', {
      method: 'DELETE',
    });
    fetchRecommendations();
  };

  if (loading) {
    return (
      <Center style={{ height: '100vh' }}>
        <Loader size="xl" />
      </Center>
    );
  }

  const ProductCard = ({ product, showScore = false, cardWidth = 200 }) => (
    <Card shadow="sm" padding="xs" radius="md" withBorder style={{ width: cardWidth }}>
      <Card.Section position="relative">
        <Image
          src={product.image_path.replace('public/', '/')}
          height={cardWidth * 1.4} // Maintain aspect ratio
          width={cardWidth}
          alt="Product"
          fallbackSrc={`https://placehold.co/${cardWidth}x${Math.round(cardWidth * 1.4)}?text=No+Image`}
        />
        <ActionIcon
          variant="filled"
          color="pink"
          radius="xl"
          size="lg"
          onClick={() => handleLike(product.id)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          <IconHeart size={20} />
        </ActionIcon>
      </Card.Section>

      <Stack gap="xs" mt="sm">
        <Group justify="flex-end">
          {showScore && product.score > 0 && (
            <Badge color="blue" variant="light" size="xs">
              {Math.round(product.score * 100)}% Match
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  );

  return (
    <AppShell
      padding="md"
      aside={{ width: 300, breakpoint: 'sm' }}
      styles={{
        main: { background: 'var(--mantine-color-gray-0)' }
      }}
    >
      <AppShell.Main>
        <Container size="xl">
          <Stack gap="xl">
            <Box mb="xl">
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Title order={1} size="h1" fw={900}>Style Discovery</Title>
                  <Text c="dimmed" size="lg">
                    Like items to see personalized recommendations based on image embeddings.
                  </Text>
                </Box>
                <SegmentedControl
                  value={category}
                  onChange={setCategory}
                  data={[
                    { label: 'Apparel', value: 'apparel' },
                    { label: 'Eyewear', value: 'eyewear' },
                  ]}
                  size="md"
                  radius="md"
                />
              </Group>
            </Box>

            <Box>
              <Title order={2} mb="md" style={{ borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                Full Catalog
              </Title>
              <Group gap="md" wrap="wrap" justify="center">
                {products.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                  />
                ))}
              </Group>
            </Box>
          </Stack>
        </Container>
      </AppShell.Main>

      <AppShell.Aside p="md">
        <AppShell.Section>
          <Group justify="space-between" mb="xs">
            <Title order={3}>For You</Title>
            <ActionIcon variant="subtle" color="gray" onClick={handleReset} title="Reset">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
          
          <Stack gap="xs" mb="md">
            <Switch 
              label="Exclusive items only" 
              checked={recommendationOnly} 
              onChange={(event) => setRecommendationOnly(event.currentTarget.checked)}
              size="xs"
            />
          </Stack>
          <Divider mb="md" />
        </AppShell.Section>

        <AppShell.Section component={ScrollArea} grow>
          {recommendations.length > 0 && recommendations.some(r => r.score > 0) ? (
            <Stack gap="md" align="center">
              {recommendations.map((product) => (
                <ProductCard 
                  key={`reco-${product.id}`} 
                  product={product} 
                  showScore={true}
                  cardWidth={240}
                />
              ))}
            </Stack>
          ) : (
            <Box py="xl" ta="center">
              <Text c="dimmed" fs="italic" size="sm">
                No recommendations yet. Like some products to get started!
              </Text>
            </Box>
          )}
        </AppShell.Section>
      </AppShell.Aside>
    </AppShell>
  );
}
